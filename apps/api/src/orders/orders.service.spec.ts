import { AuditAction, AuditSource, CreditStatus, OrderStatus, Prisma, ProductFamily, SellerPriority } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

const customer = {
  id: 'customer-1',
  code: 'CLI-001',
  name: 'Aceros del Norte SA',
};

const destination = {
  id: 'destination-catalog-1',
};

const productCatalog = {
  id: 'product-catalog-1',
  code: 'SKU-001',
  family: ProductFamily.PROFILE,
  description: 'Perfil IPN 200',
  weightKg: new Prisma.Decimal(500),
  lengthMm: 4000,
  widthMm: 220,
  heightMm: 220,
  stackable: true,
  rotationAllowed: true,
};

function createService() {
  const prisma = {
    customer: { findUnique: vi.fn() },
    destinationCatalog: { findUnique: vi.fn() },
    productCatalog: { findMany: vi.fn() },
    order: { create: vi.fn() },
  };
  const audit = { record: vi.fn() };
  const service = new OrdersService(prisma as unknown as PrismaService, audit as unknown as AuditService);

  return { audit, prisma, service };
}

describe('OrdersService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates traceable order demand with customer, seller priority, destination, items, and audit context', async () => {
    const { audit, prisma, service } = createService();
    const requestedDeliveryAt = '2026-05-21T10:00:00.000Z';
    const createdAt = new Date('2026-05-14T10:00:00.000Z');
    const savedOrder = {
      id: 'order-1',
      code: 'PED-001',
      customerId: customer.id,
      customer,
      status: OrderStatus.RECEIVED,
      creditStatus: CreditStatus.PENDING,
      sellerPriority: SellerPriority.URGENT,
      destinationCatalogId: destination.id,
      destinationName: 'Rosario Sur',
      requestedDeliveryAt: new Date(requestedDeliveryAt),
      externalRef: 'OC-001',
      notes: 'Pedido demo',
      createdAt,
      updatedAt: createdAt,
      items: [
        {
          id: 'order-item-1',
          orderId: 'order-1',
          productCatalogId: productCatalog.id,
          productCode: productCatalog.code,
          description: 'Perfiles para Rosario',
          quantity: 4,
          weightKg: new Prisma.Decimal(500),
          lengthMm: 4000,
          widthMm: 220,
          heightMm: 220,
          notes: null,
          createdAt,
          updatedAt: createdAt,
          productCatalog,
        },
      ],
    };
    prisma.customer.findUnique.mockResolvedValue(customer);
    prisma.destinationCatalog.findUnique.mockResolvedValue(destination);
    prisma.productCatalog.findMany.mockResolvedValue([{ id: productCatalog.id }]);
    prisma.order.create.mockResolvedValue(savedOrder);

    const result = await service.createOrder(
      {
        code: savedOrder.code,
        customerId: customer.id,
        sellerPriority: SellerPriority.URGENT,
        destinationCatalogId: destination.id,
        destinationName: savedOrder.destinationName,
        requestedDeliveryAt,
        externalRef: savedOrder.externalRef,
        notes: savedOrder.notes,
        items: [
          {
            productCatalogId: productCatalog.id,
            productCode: productCatalog.code,
            description: 'Perfiles para Rosario',
            quantity: 4,
            weightKg: 500,
            lengthMm: 4000,
            widthMm: 220,
            heightMm: 220,
          },
        ],
      },
      'seller@example.com',
    );

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: savedOrder.code,
          customerId: customer.id,
          sellerPriority: SellerPriority.URGENT,
          destinationCatalogId: destination.id,
          destinationName: savedOrder.destinationName,
          requestedDeliveryAt: new Date(requestedDeliveryAt),
          items: {
            create: [expect.objectContaining({ productCatalogId: productCatalog.id, productCode: productCatalog.code, quantity: 4 })],
          },
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'seller@example.com',
        source: AuditSource.API,
        action: AuditAction.CREATED,
        entityType: 'Order',
        entityId: savedOrder.id,
        entityCode: savedOrder.code,
        relatedEntityType: 'Customer',
        relatedEntityId: customer.id,
        after: { status: OrderStatus.RECEIVED, creditStatus: CreditStatus.PENDING, itemCount: 1 },
      }),
    );
    expect(result).toMatchObject({
      code: savedOrder.code,
      customer,
      sellerPriority: SellerPriority.URGENT,
      destinationName: 'Rosario Sur',
      items: [{ productCode: productCatalog.code, quantity: 4, weightKg: 500, productCatalog: { weightKg: 500 } }],
    });
  });
});
