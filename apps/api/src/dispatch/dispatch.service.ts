import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditSource, PreparationStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { canCreateDispatchOrder, ensureDispatchReadyForLoading, markLoadOperationLinked, markReadyToLoad } from '../domain/dispatch/dispatch-lifecycle';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeliveryPlanDto } from './dto/create-delivery-plan.dto';
import { CreateDispatchOrderDto } from './dto/create-dispatch-order.dto';

type Decimalish = Prisma.Decimal | number | string | null | undefined;

function decimalToNumber(value: Decimalish) {
  if (value === null || value === undefined) return undefined;
  return Number(value);
}

function generateCode(prefix: string) {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}

function preparationsAllowLoading(preparations: Array<{ status: PreparationStatus; discrepancyQuantity: number }>) {
  return preparations.length > 0 && preparations.every((preparation) => preparation.status === PreparationStatus.READY && preparation.discrepancyQuantity === 0);
}

@Injectable()
export class DispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createDeliveryPlan(dto: CreateDeliveryPlanDto, actor?: string) {
    try {
      const plan = await this.prisma.deliveryPlan.create({
        data: {
          code: dto.code ?? generateCode('DP'),
          plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : undefined,
          notes: dto.notes,
        },
      });
      await this.audit.record({
        actor,
        source: AuditSource.API,
        action: AuditAction.CREATED,
        entityType: 'DeliveryPlan',
        entityId: plan.id,
        entityCode: plan.code,
        after: { code: plan.code, status: plan.status, plannedDate: plan.plannedDate?.toISOString() ?? null },
      });
      return plan;
    } catch (error) {
      this.handleUniqueConstraint(error, 'A delivery plan with this code already exists.');
      throw error;
    }
  }

  async findDeliveryPlans() {
    return this.prisma.deliveryPlan.findMany({ orderBy: [{ plannedDate: 'asc' }, { createdAt: 'desc' }] });
  }

  async createDispatchOrder(dto: CreateDispatchOrderDto, actor?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { customer: true, items: { orderBy: { createdAt: 'asc' }, include: { productCatalog: true } } },
    });
    if (!order) throw new NotFoundException('Order not found.');

    if (!canCreateDispatchOrder({ status: order.status, creditStatus: order.creditStatus, itemCount: order.items.length })) {
      throw new BadRequestException('Only released orders with released credit and at least one item can become dispatch orders.');
    }
    if (order.items.some((item) => !item.productCatalogId || !item.productCatalog)) {
      throw new BadRequestException('All order items must reference a product catalog record before dispatch handoff to loading.');
    }
    if (dto.deliveryPlanId) await this.ensureDeliveryPlanExists(dto.deliveryPlanId);

    try {
      const dispatchOrder = await this.prisma.dispatchOrder.create({
        data: {
          code: dto.code ?? generateCode('DSP'),
          orderId: order.id,
          deliveryPlanId: dto.deliveryPlanId,
          destinationCatalogId: order.destinationCatalogId,
          destinationNameSnapshot: order.destinationName,
          sellerPriority: order.sellerPriority,
          requestedDeliveryAt: order.requestedDeliveryAt,
          notes: dto.notes,
          items: {
            create: order.items.map((item) => ({
              orderItemId: item.id,
              productCatalogId: item.productCatalogId!,
              productCodeSnapshot: item.productCode,
              descriptionSnapshot: item.description,
              quantity: item.quantity,
              weightKg: item.weightKg,
              lengthMm: item.lengthMm,
              widthMm: item.widthMm,
              heightMm: item.heightMm,
            })),
          },
        },
        include: this.dispatchInclude(),
      });

      await this.audit.record({
        actor,
        source: AuditSource.API,
        action: AuditAction.CREATED,
        entityType: 'DispatchOrder',
        entityId: dispatchOrder.id,
        entityCode: dispatchOrder.code,
        relatedEntityType: 'Order',
        relatedEntityId: dispatchOrder.orderId,
        after: { status: dispatchOrder.status, itemCount: dispatchOrder.items.length },
      });

      return this.toDispatchResponse(dispatchOrder);
    } catch (error) {
      this.handleUniqueConstraint(error, 'A dispatch order with this code already exists.');
      throw error;
    }
  }

  async findDispatchOrders() {
    const orders = await this.prisma.dispatchOrder.findMany({
      orderBy: [{ status: 'asc' }, { requestedDeliveryAt: 'asc' }, { createdAt: 'desc' }],
      include: this.dispatchInclude(),
    });
    return orders.map((order) => this.toDispatchResponse(order));
  }

  async markReady(id: string, actor?: string) {
    const dispatchOrder = await this.prisma.dispatchOrder.findUnique({ where: { id }, include: { items: true, preparations: true } });
    if (!dispatchOrder) throw new NotFoundException('Dispatch order not found.');
    if (dispatchOrder.items.length === 0) throw new BadRequestException('Dispatch order must have at least one item before loading handoff.');
    if (!preparationsAllowLoading(dispatchOrder.preparations)) {
      throw new BadRequestException('Dispatch order needs a ready warehouse preparation without discrepancies before loading handoff.');
    }

    const updated = await this.prisma.dispatchOrder.update({ where: { id }, data: markReadyToLoad(), include: this.dispatchInclude() });
    await this.audit.record({
      actor,
      source: AuditSource.API,
      action: AuditAction.READY_TO_LOAD,
      entityType: 'DispatchOrder',
      entityId: updated.id,
      entityCode: updated.code,
      relatedEntityType: 'Order',
      relatedEntityId: updated.orderId,
      before: { status: dispatchOrder.status },
      after: { status: updated.status },
    });
    return this.toDispatchResponse(updated);
  }

  async createLoadOperation(id: string, actor?: string) {
    const dispatchOrder = await this.prisma.dispatchOrder.findUnique({
      where: { id },
      include: {
        order: { include: { customer: true } },
        deliveryPlan: true,
        destinationCatalog: true,
        loadOperation: true,
        preparations: true,
        items: { orderBy: { createdAt: 'asc' }, include: { productCatalog: true } },
      },
    });
    if (!dispatchOrder) throw new NotFoundException('Dispatch order not found.');
    if (dispatchOrder.loadOperationId) return this.loadOperationSummary(dispatchOrder.loadOperation!);
    if (!ensureDispatchReadyForLoading({ status: dispatchOrder.status, itemCount: dispatchOrder.items.length })) {
      throw new BadRequestException('Dispatch order must be READY_TO_LOAD before creating a load operation.');
    }
    if (!preparationsAllowLoading(dispatchOrder.preparations)) {
      throw new BadRequestException('Ready warehouse preparation is required before creating a load operation.');
    }

    const operation = await this.prisma.$transaction(async (tx) => {
      const createdOperation = await tx.loadOperation.create({
        data: {
          code: generateCode('OP'),
          name: `Carga ${dispatchOrder.code}`,
          notes: this.operationNotes(dispatchOrder),
          scheduledAt: dispatchOrder.requestedDeliveryAt,
        },
      });

      let destinationId: string | undefined;
      if (dispatchOrder.destinationNameSnapshot || dispatchOrder.destinationCatalog) {
        const destination = await tx.destination.create({
          data: {
            operationId: createdOperation.id,
            code: dispatchOrder.destinationCatalog?.code,
            name: dispatchOrder.destinationNameSnapshot ?? dispatchOrder.destinationCatalog?.name ?? 'Sin destino',
            address: dispatchOrder.destinationCatalog?.address,
            notes: dispatchOrder.destinationCatalog?.notes,
            unloadingOrder: 1,
          },
        });
        destinationId = destination.id;
      }

      await tx.loadProduct.createMany({
        data: dispatchOrder.items.map((item) => ({
          operationId: createdOperation.id,
          destinationId,
          code: item.productCodeSnapshot,
          family: item.productCatalog.family,
          description: item.descriptionSnapshot ?? item.productCatalog.description,
          quantity: item.quantity,
          weightKg: item.weightKg ?? item.productCatalog.weightKg,
          lengthMm: item.lengthMm ?? item.productCatalog.lengthMm,
          widthMm: item.widthMm ?? item.productCatalog.widthMm,
          heightMm: item.heightMm ?? item.productCatalog.heightMm,
          stackable: item.productCatalog.stackable,
          rotationAllowed: item.productCatalog.rotationAllowed,
        })),
      });

      await tx.dispatchOrder.update({ where: { id }, data: { ...markLoadOperationLinked(), loadOperationId: createdOperation.id } });
      await this.audit.recordWithClient(tx, {
        actor,
        source: AuditSource.API,
        action: AuditAction.LOAD_OPERATION_CREATED,
        entityType: 'DispatchOrder',
        entityId: dispatchOrder.id,
        entityCode: dispatchOrder.code,
        relatedEntityType: 'LoadOperation',
        relatedEntityId: createdOperation.id,
        before: { status: dispatchOrder.status, loadOperationId: dispatchOrder.loadOperationId },
        after: { status: markLoadOperationLinked().status, loadOperationId: createdOperation.id },
      });
      return createdOperation;
    });

    return this.loadOperationSummary(operation);
  }

  private async ensureDeliveryPlanExists(id: string) {
    const plan = await this.prisma.deliveryPlan.findUnique({ where: { id }, select: { id: true } });
    if (!plan) throw new NotFoundException('Delivery plan not found.');
  }

  private dispatchInclude() {
    return {
      order: { include: { customer: true } },
      deliveryPlan: true,
      items: { orderBy: { createdAt: 'asc' }, include: { productCatalog: true } },
    } satisfies Prisma.DispatchOrderInclude;
  }

  private toDispatchResponse(dispatchOrder: Prisma.DispatchOrderGetPayload<{ include: ReturnType<DispatchService['dispatchInclude']> }>) {
    return {
      ...dispatchOrder,
      items: dispatchOrder.items.map((item) => ({
        ...item,
        weightKg: decimalToNumber(item.weightKg),
        productCatalog: {
          ...item.productCatalog,
          weightKg: decimalToNumber(item.productCatalog.weightKg),
        },
      })),
    };
  }

  private operationNotes(dispatchOrder: Prisma.DispatchOrderGetPayload<{ include: { order: { include: { customer: true } }; deliveryPlan: true; destinationCatalog: true } }>) {
    const lines = [`Dispatch ${dispatchOrder.code}`, `Pedido ${dispatchOrder.order.code}`, `Cliente ${dispatchOrder.order.customer.name}`];
    if (dispatchOrder.deliveryPlan) lines.push(`DeliveryPlan ${dispatchOrder.deliveryPlan.code}`);
    if (dispatchOrder.notes) lines.push(dispatchOrder.notes);
    return lines.join('\n');
  }

  private loadOperationSummary(operation: { id: string; code: string; status: string; name: string | null; notes: string | null; scheduledAt: Date | null; createdAt: Date; updatedAt: Date }) {
    return operation;
  }

  private handleUniqueConstraint(error: unknown, message: string) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(message);
    }
  }
}
