import 'dotenv/config';
import { CreditStatus, LoadingMethod, OrderStatus, ProductFamily, SellerPriority, TruckZoneType } from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
import { CustomsService } from '../src/customs/customs.service';
import { DispatchService } from '../src/dispatch/dispatch.service';
import { LoadingPlansService } from '../src/loading-plans/loading-plans.service';
import { OrdersService } from '../src/orders/orders.service';
import { PreparationService } from '../src/preparation/preparation.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ReservationsService } from '../src/reservations/reservations.service';
import { TransportService } from '../src/transport/transport.service';

const WEB_BASE_URL = 'http://localhost:5173';
const SEED_ACTOR = 'seed:demo-lifecycle';

const CODES = {
  customers: ['CLI-ACEROS-NORTE', 'CLI-METALURGICA-SUR'],
  deliveryPlan: 'DP-DEMO-LIFECYCLE-001',
  dispatchOrders: ['DSP-DEMO-READY-001', 'DSP-DEMO-PLANNED-001'],
  orders: ['PED-DEMO-READY-001', 'PED-DEMO-BLOCKED-001', 'PED-DEMO-PLANNED-001'],
  products: ['SKU-PER-IPN-200', 'SKU-CHAPA-8MM', 'SKU-TUB-RECT-12080', 'SKU-PALLET-BULONERIA'],
  destinations: ['DST-ROSARIO-SUR', 'DST-VGG-INDUSTRIAL', 'DST-SAN-NICOLAS'],
  truck: 'TRACTOR-DEMO-01',
  trailer: 'SEMI-PLAYO-136-DEMO',
};

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    await resetDemoData(prisma);

    const auditService = new AuditService(prisma);
    const ordersService = new OrdersService(prisma, auditService);
    const dispatchService = new DispatchService(prisma, auditService);
    const reservationsService = new ReservationsService(prisma, auditService);
    const preparationService = new PreparationService(prisma, auditService);
    const customsService = new CustomsService(prisma, auditService);
    const loadingPlansService = new LoadingPlansService(prisma, auditService);
    const transportService = new TransportService(prisma, auditService);

    const catalog = await createCatalog(prisma);
    const customers = await createCustomers(ordersService);
    const orders = await createOrders(ordersService, customers, catalog);

    await ordersService.releaseCredit(orders.ready.id, SEED_ACTOR);
    await ordersService.holdCredit(orders.blocked.id, SEED_ACTOR);
    await ordersService.releaseCredit(orders.planned.id, SEED_ACTOR);

    const deliveryPlan = await dispatchService.createDeliveryPlan({
      code: CODES.deliveryPlan,
      plannedDate: '2026-05-21T08:00:00.000Z',
      notes: 'Plan demo: dos pedidos liberados y un pedido bloqueado por credito para mostrar el gate comercial.',
    }, SEED_ACTOR);

    const readyDispatch = await dispatchService.createDispatchOrder({
      code: CODES.dispatchOrders[0],
      orderId: orders.ready.id,
      deliveryPlanId: deliveryPlan.id,
      notes: 'Dispatch demo que recorre reserva, preparacion, aduana, carga aprobada y salida transporte.',
    }, SEED_ACTOR);
    await reservePrepareAndClearDispatch(reservationsService, preparationService, customsService, readyDispatch.id, readyDispatch.items);
    await dispatchService.markReady(readyDispatch.id, SEED_ACTOR);
    const linkedOperation = await dispatchService.createLoadOperation(readyDispatch.id, SEED_ACTOR);
    const currentPlan = await attachTruckAndGeneratePlan(prisma, loadingPlansService, linkedOperation.id, catalog);
    const approvedPlan = await loadingPlansService.approve(currentPlan.id, SEED_ACTOR);
    const transportExit = await completeTransportExit(transportService, readyDispatch.id);

    const plannedDispatch = await dispatchService.createDispatchOrder({
      code: CODES.dispatchOrders[1],
      orderId: orders.planned.id,
      deliveryPlanId: deliveryPlan.id,
      notes: 'Dispatch liberado pero todavia PLANNED para probar el paso Ready desde el frontend.',
    }, SEED_ACTOR);

    const auditCount = await prisma.auditEvent.count();
    const linkedOperationDetail = await prisma.loadOperation.findUniqueOrThrow({
      where: { id: linkedOperation.id },
      include: { plans: { where: { isCurrent: true }, include: { metrics: true } } },
    });
    const persistedCurrentPlan = linkedOperationDetail.plans[0];

    console.log(JSON.stringify({
      message: 'Demo lifecycle seed loaded',
      codes: {
        deliveryPlan: deliveryPlan.code,
        eligibleOrder: orders.ready.code,
        blockedOrder: orders.blocked.code,
        plannedOrder: orders.planned.code,
        readyDispatch: readyDispatch.code,
        plannedDispatch: plannedDispatch.code,
        linkedLoadOperation: linkedOperationDetail.code,
      },
      status: {
        eligibleOrder: `${OrderStatus.RELEASED}/${CreditStatus.RELEASED}`,
        blockedOrder: `${OrderStatus.CREDIT_HELD}/${CreditStatus.HELD}`,
        readyDispatch: 'LOAD_OPERATION_LINKED',
        plannedDispatch: plannedDispatch.status,
        loadingPlan: approvedPlan.planStatus,
        transportExit: transportExit.status,
        auditEvents: auditCount,
      },
      frontendPaths: {
        lifecycle: `${WEB_BASE_URL}/lifecycle`,
        orders: `${WEB_BASE_URL}/orders`,
        dispatch: `${WEB_BASE_URL}/dispatch`,
        operation: `${WEB_BASE_URL}/operations/${linkedOperation.id}`,
        planner: `${WEB_BASE_URL}/operations/${linkedOperation.id}/planner`,
        report: `${WEB_BASE_URL}/operations/${linkedOperation.id}/report`,
      },
      planner: persistedCurrentPlan ? {
        planId: persistedCurrentPlan.id,
        version: persistedCurrentPlan.version,
        status: persistedCurrentPlan.status,
        placedItems: persistedCurrentPlan.metrics?.placedItemCount ?? 0,
        unplacedItems: persistedCurrentPlan.metrics?.unplacedItemCount ?? 0,
        criticalAlerts: persistedCurrentPlan.metrics?.criticalAlertCount ?? 0,
        warningAlerts: persistedCurrentPlan.metrics?.warningAlertCount ?? 0,
      } : null,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function resetDemoData(prisma: PrismaService) {
  await prisma.$transaction([
    prisma.auditEvent.deleteMany(),
    prisma.transportExit.deleteMany(),
    prisma.customsRelease.deleteMany(),
    prisma.preparationItem.deleteMany(),
    prisma.preparation.deleteMany(),
    prisma.reservationItem.deleteMany(),
    prisma.reservation.deleteMany(),
    prisma.loadAlert.deleteMany(),
    prisma.loadingStep.deleteMany(),
    prisma.unplacedItem.deleteMany(),
    prisma.placedItem.deleteMany(),
    prisma.planMetrics.deleteMany(),
    prisma.loadingPlan.deleteMany(),
    prisma.loadProduct.deleteMany(),
    prisma.destination.deleteMany(),
    prisma.truckZone.deleteMany(),
    prisma.truck.deleteMany(),
    prisma.dispatchOrderItem.deleteMany(),
    prisma.dispatchOrder.deleteMany(),
    prisma.deliveryPlan.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.operationProductAssignment.deleteMany(),
    prisma.operationDestinationAssignment.deleteMany(),
    prisma.operationTruckZone.deleteMany(),
    prisma.operationVehicleAssignment.deleteMany(),
    prisma.loadOperation.deleteMany(),
    prisma.zoneTemplate.deleteMany(),
    prisma.trailerCatalog.deleteMany(),
    prisma.truckCatalog.deleteMany(),
    prisma.destinationCatalog.deleteMany(),
    prisma.productCatalog.deleteMany(),
  ]);
}

async function reservePrepareAndClearDispatch(
  reservationsService: ReservationsService,
  preparationService: PreparationService,
  customsService: CustomsService,
  dispatchOrderId: string,
  dispatchItems: Array<{ id: string; quantity: number }>,
) {
  const reservation = await reservationsService.createReservation({
    dispatchOrderId,
    availability: dispatchItems.map((item) => ({ dispatchOrderItemId: item.id, availableQuantity: item.quantity })),
    externalRef: 'INV-DEMO-RESERVA-001',
    notes: 'Reserva completa demo antes de preparacion.',
  }, SEED_ACTOR);

  await preparationService.createPreparation({
    reservationId: reservation.id,
    items: reservation.items.map((item) => ({ reservationItemId: item.id, readyQuantity: item.reservedQuantity })),
    notes: 'Preparacion demo lista sin discrepancias.',
  }, SEED_ACTOR);

  const customsRelease = await customsService.createRelease({
    dispatchOrderId,
    externalRef: 'ADU-DEMO-001',
    notes: 'Checkpoint aduana demo requerido para liberar handoff a carga.',
  }, SEED_ACTOR);
  await customsService.clearRelease(customsRelease.id, { externalRef: 'ADU-DEMO-001-CLEARED', notes: 'Aduana demo liberada.' }, SEED_ACTOR);
}

async function completeTransportExit(transportService: TransportService, dispatchOrderId: string) {
  const transportExit = await transportService.createExit({
    dispatchOrderId,
    externalRef: 'TRP-DEMO-001',
    notes: 'Salida transporte demo posterior a plan aprobado.',
  }, SEED_ACTOR);
  await transportService.markDocsReady(transportExit.id, { externalRef: 'DOC-DEMO-001', notes: 'Documentacion demo lista.' }, SEED_ACTOR);
  await transportService.recordScale(transportExit.id, { scaleWeightKg: 23120, externalRef: 'BAS-DEMO-001', notes: 'Pesaje demo registrado.' }, SEED_ACTOR);
  await transportService.authorizeExit(transportExit.id, SEED_ACTOR);
  return transportService.markDispatched(transportExit.id, SEED_ACTOR);
}

async function createCatalog(prisma: PrismaService) {
  const [truck, trailer] = await Promise.all([
    prisma.truckCatalog.create({
      data: {
        plate: CODES.truck,
        description: 'Tractor demo con semirremolque playo de 13.6m para cargas siderurgicas.',
        loadingMethod: LoadingMethod.REAR,
        maxPayloadKg: 28000,
        lengthMm: 13600,
        widthMm: 2480,
        heightMm: 2700,
        zoneTemplates: { create: defaultZones() },
      },
      include: { zoneTemplates: { orderBy: { type: 'asc' } } },
    }),
    prisma.trailerCatalog.create({
      data: {
        code: CODES.trailer,
        description: 'Semirremolque playo demo con capacidad para paquetes largos y pallets.',
        maxPayloadKg: 28000,
        lengthMm: 13600,
        widthMm: 2480,
        heightMm: 2700,
      },
    }),
  ]);

  const [rosario, villaGalvez, sanNicolas] = await Promise.all([
    prisma.destinationCatalog.create({ data: { code: CODES.destinations[0], name: 'Rosario Sur - nave montaje', address: 'Av. Circunvalacion y Ovidio Lagos, Rosario', notes: 'Primera descarga: acceso rapido desde puerta trasera.' } }),
    prisma.destinationCatalog.create({ data: { code: CODES.destinations[1], name: 'Villa Gobernador Galvez - planta industrial', address: 'Parque Industrial VGG, Santa Fe', notes: 'Descarga con puente grua.' } }),
    prisma.destinationCatalog.create({ data: { code: CODES.destinations[2], name: 'San Nicolas - obra laminacion', address: 'Ruta 188 km 6, San Nicolas', notes: 'Ultima descarga, paquetes pesados cerca de cabina.' } }),
  ]);

  const [profile, sheet, tube, pallet] = await Promise.all([
    prisma.productCatalog.create({ data: productCatalog(CODES.products[0], ProductFamily.PROFILE, 'Perfil IPN 200 x 4m', 500, 4000, 220, 220, true, true) }),
    prisma.productCatalog.create({ data: productCatalog(CODES.products[1], ProductFamily.SHEET, 'Chapas 8mm 3000x1200 palletizadas', 740, 3000, 1200, 260, true, false) }),
    prisma.productCatalog.create({ data: productCatalog(CODES.products[2], ProductFamily.TUBE, 'Tubo rectangular 120x80 x 4m', 350, 4000, 180, 160, true, true) }),
    prisma.productCatalog.create({ data: productCatalog(CODES.products[3], ProductFamily.GENERIC_PACKAGE, 'Pallet de buloneria y consumibles', 620, 1200, 1000, 850, false, true) }),
  ]);

  return { truck, trailer, destinations: { rosario, villaGalvez, sanNicolas }, products: { profile, sheet, tube, pallet } };
}

async function createCustomers(ordersService: OrdersService) {
  const [acerosNorte, metalurgicaSur] = await Promise.all([
    ordersService.createCustomer({ code: CODES.customers[0], name: 'Aceros del Norte SA', taxId: '30-71111111-7', notes: 'Cliente activo con pedidos liberados para dispatch.' }, SEED_ACTOR),
    ordersService.createCustomer({ code: CODES.customers[1], name: 'Metalurgica Sur SRL', taxId: '30-72222222-8', notes: 'Cliente demo con pedido bloqueado por credito.' }, SEED_ACTOR),
  ]);
  return { acerosNorte, metalurgicaSur };
}

async function createOrders(ordersService: OrdersService, customers: Awaited<ReturnType<typeof createCustomers>>, catalog: Awaited<ReturnType<typeof createCatalog>>) {
  const ready = await ordersService.createOrder({
    code: CODES.orders[0],
    customerId: customers.acerosNorte.id,
    sellerPriority: SellerPriority.URGENT,
    destinationCatalogId: catalog.destinations.rosario.id,
    destinationName: catalog.destinations.rosario.name,
    requestedDeliveryAt: '2026-05-21T10:00:00.000Z',
    externalRef: 'OC-ACN-9821',
    notes: 'Pedido liberado que recorre dispatch -> ready -> load operation -> planner.',
    items: [
      orderItem(catalog.products.profile.id, CODES.products[0], 'Perfiles para nave Rosario', 4),
      orderItem(catalog.products.pallet.id, CODES.products[3], 'Pallet complementario Rosario', 1),
    ],
  }, SEED_ACTOR);

  const blocked = await ordersService.createOrder({
    code: CODES.orders[1],
    customerId: customers.metalurgicaSur.id,
    sellerPriority: SellerPriority.HIGH,
    destinationCatalogId: catalog.destinations.villaGalvez.id,
    destinationName: catalog.destinations.villaGalvez.name,
    requestedDeliveryAt: '2026-05-21T14:00:00.000Z',
    externalRef: 'OC-MTS-1044',
    notes: 'Pedido bloqueado: queda fuera de demanda dispatch hasta liberar credito.',
    items: [orderItem(catalog.products.sheet.id, CODES.products[1], 'Chapas para VGG retenidas por credito', 3)],
  }, SEED_ACTOR);

  const planned = await ordersService.createOrder({
    code: CODES.orders[2],
    customerId: customers.acerosNorte.id,
    sellerPriority: SellerPriority.NORMAL,
    destinationCatalogId: catalog.destinations.sanNicolas.id,
    destinationName: catalog.destinations.sanNicolas.name,
    requestedDeliveryAt: '2026-05-22T09:00:00.000Z',
    externalRef: 'OC-ACN-9822',
    notes: 'Pedido liberado con dispatch PLANNED para demostrar el boton Ready.',
    items: [orderItem(catalog.products.tube.id, CODES.products[2], 'Tubos para San Nicolas', 5)],
  }, SEED_ACTOR);

  return { ready, blocked, planned };
}

async function attachTruckAndGeneratePlan(prisma: PrismaService, loadingPlansService: LoadingPlansService, operationId: string, catalog: Awaited<ReturnType<typeof createCatalog>>) {
  const truck = await prisma.truck.create({
    data: {
      operationId,
      plate: catalog.truck.plate,
      description: catalog.truck.description,
      loadingMethod: catalog.truck.loadingMethod,
      maxPayloadKg: catalog.truck.maxPayloadKg,
      lengthMm: catalog.truck.lengthMm,
      widthMm: catalog.truck.widthMm,
      heightMm: catalog.truck.heightMm,
    },
  });

  await prisma.truckZone.createMany({
    data: catalog.truck.zoneTemplates.map((zone) => ({
      truckId: truck.id,
      type: zone.type,
      name: zone.name,
      maxWeightKg: zone.maxWeightKg,
      startXMm: zone.startXMm,
      endXMm: zone.endXMm,
      startYMm: zone.startYMm,
      endYMm: zone.endYMm,
    })),
  });

  return loadingPlansService.generate(operationId);
}

function defaultZones() {
  return [
    { type: TruckZoneType.CABIN_SIDE, name: 'Tercio delantero / cabina', maxWeightKg: 9500, startXMm: 0, endXMm: 4533, startYMm: 0, endYMm: 2480 },
    { type: TruckZoneType.CENTER, name: 'Tercio central', maxWeightKg: 9500, startXMm: 4533, endXMm: 9066, startYMm: 0, endYMm: 2480 },
    { type: TruckZoneType.DOOR_SIDE, name: 'Tercio trasero / puerta', maxWeightKg: 9000, startXMm: 9066, endXMm: 13600, startYMm: 0, endYMm: 2480 },
  ];
}

function productCatalog(code: string, family: ProductFamily, description: string, weightKg: number, lengthMm: number, widthMm: number, heightMm: number, stackable: boolean, rotationAllowed: boolean) {
  return { code, family, description, weightKg, lengthMm, widthMm, heightMm, stackable, rotationAllowed };
}

function orderItem(productCatalogId: string, productCode: string, description: string, quantity: number) {
  return { productCatalogId, productCode, description, quantity };
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
