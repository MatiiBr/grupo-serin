import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { canFeedDispatchDemand, applyCreditHold, applyCreditRelease } from '../domain/orders/order-lifecycle';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

type Decimalish = Prisma.Decimal | number | string | null | undefined;

function decimalToNumber(value: Decimalish) {
  if (value === null || value === undefined) return undefined;
  return Number(value);
}

function generateOrderCode() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PED-${date}-${suffix}`;
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createCustomer(dto: CreateCustomerDto) {
    try {
      return await this.prisma.customer.create({ data: dto });
    } catch (error) {
      this.handleUniqueConstraint(error, 'A customer with this code already exists.');
      throw error;
    }
  }

  async searchCustomers(q?: string) {
    return this.prisma.customer.findMany({
      where: q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              { taxId: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto) {
    await this.ensureCustomerExists(id);

    try {
      return await this.prisma.customer.update({ where: { id }, data: dto });
    } catch (error) {
      this.handleUniqueConstraint(error, 'A customer with this code already exists.');
      throw error;
    }
  }

  async createOrder(dto: CreateOrderDto) {
    await this.ensureCustomerExists(dto.customerId);
    await this.ensureDestinationCatalogExists(dto.destinationCatalogId);
    await this.ensureProductCatalogsExist(dto.items.map((item) => item.productCatalogId).filter((id): id is string => Boolean(id)));

    try {
      const order = await this.prisma.order.create({
        data: {
          code: dto.code ?? generateOrderCode(),
          customerId: dto.customerId,
          sellerPriority: dto.sellerPriority,
          destinationCatalogId: dto.destinationCatalogId,
          destinationName: dto.destinationName,
          requestedDeliveryAt: dto.requestedDeliveryAt ? new Date(dto.requestedDeliveryAt) : undefined,
          externalRef: dto.externalRef,
          notes: dto.notes,
          items: { create: dto.items },
        },
        include: this.orderInclude(),
      });

      return this.toOrderResponse(order);
    } catch (error) {
      this.handleUniqueConstraint(error, 'An order with this code already exists.');
      throw error;
    }
  }

  async findOrders() {
    const orders = await this.prisma.order.findMany({
      orderBy: [{ sellerPriority: 'desc' }, { createdAt: 'desc' }],
      include: this.orderInclude(),
    });

    return orders.map((order) => this.toOrderResponse(order));
  }

  async findOrder(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: this.orderInclude() });
    if (!order) throw new NotFoundException('Order not found.');
    return this.toOrderResponse(order);
  }

  async holdCredit(id: string) {
    await this.ensureOrderExists(id);
    const order = await this.prisma.order.update({ where: { id }, data: applyCreditHold(), include: this.orderInclude() });
    return this.toOrderResponse(order);
  }

  async releaseCredit(id: string) {
    await this.ensureOrderExists(id);
    const order = await this.prisma.order.update({ where: { id }, data: applyCreditRelease(), include: this.orderInclude() });
    return this.toOrderResponse(order);
  }

  async findDispatchDemand() {
    const orders = await this.prisma.order.findMany({
      where: { status: 'RELEASED', creditStatus: 'RELEASED' },
      orderBy: [{ sellerPriority: 'desc' }, { requestedDeliveryAt: 'asc' }, { createdAt: 'asc' }],
      include: this.orderInclude(),
    });

    return orders.filter(canFeedDispatchDemand).map((order) => this.toOrderResponse(order));
  }

  private async ensureCustomerExists(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id }, select: { id: true } });
    if (!customer) throw new NotFoundException('Customer not found.');
  }

  private async ensureOrderExists(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!order) throw new NotFoundException('Order not found.');
  }

  private async ensureDestinationCatalogExists(id?: string) {
    if (!id) return;
    const destination = await this.prisma.destinationCatalog.findUnique({ where: { id }, select: { id: true } });
    if (!destination) throw new NotFoundException('Destination catalog record not found.');
  }

  private async ensureProductCatalogsExist(ids: string[]) {
    if (ids.length === 0) return;
    const uniqueIds = [...new Set(ids)];
    const found = await this.prisma.productCatalog.findMany({ where: { id: { in: uniqueIds } }, select: { id: true } });
    if (found.length !== uniqueIds.length) throw new NotFoundException('One or more product catalog records were not found.');
  }

  private orderInclude() {
    return {
      customer: true,
      items: { orderBy: { createdAt: 'asc' }, include: { productCatalog: true } },
    } satisfies Prisma.OrderInclude;
  }

  private toOrderResponse(order: Prisma.OrderGetPayload<{ include: ReturnType<OrdersService['orderInclude']> }>) {
    return {
      ...order,
      items: order.items.map((item) => ({
        ...item,
        weightKg: decimalToNumber(item.weightKg),
        productCatalog: item.productCatalog
          ? {
              ...item.productCatalog,
              weightKg: decimalToNumber(item.productCatalog.weightKg),
            }
          : null,
      })),
    };
  }

  private handleUniqueConstraint(error: unknown, message: string) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(message);
    }
  }
}
