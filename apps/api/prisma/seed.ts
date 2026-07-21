import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import {
  AuditAction,
  AuditSource,
  CreditStatus,
  CustomsReleaseStatus,
  DispatchOrderStatus,
  LoadingMethod,
  OrderStatus,
  PreparationStatus,
  ProductFamily,
  ReservationStatus,
  SellerPriority,
  TransportExitStatus,
  TruckZoneType,
} from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
import { LoadingPlansService } from '../src/loading-plans/loading-plans.service';
import { PrismaService } from '../src/prisma/prisma.service';

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

type SheetRow = {
  documentNumber: string;
  description: string;
  preparedQuantity: string;
  preparedUnit: string;
  actualWeightKg: string;
  missingReason?: string;
  warehouse?: string;
  confirmedWeightKg: string;
  packageType?: string;
  observations?: string;
  destinationCode: string;
  destinationName: string;
};

type ProductShape = {
  family: ProductFamily;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  stackable: boolean;
  rotationAllowed: boolean;
};

const serinRows: SheetRow[] = [
  { documentNumber: '7600001326', description: 'CHAPA LISA BLANCA C25 1.20X2.40M CORT.', preparedQuantity: '50.000', preparedUnit: 'UN', actualWeightKg: '640.000', warehouse: 'NAVE1-2N', confirmedWeightKg: '640.000', packageType: 'A', destinationCode: 'A120', destinationName: 'Centro A120 Distribucion Pilar' },
  { documentNumber: '7600001326', description: 'MEMB. AISLATECH "H10RA" 10MM SOLAPA 1X20', preparedQuantity: '20.000', preparedUnit: 'UN', actualWeightKg: '106.000', warehouse: 'NAVE5', confirmedWeightKg: '106.000', packageType: 'X', destinationCode: 'A120', destinationName: 'Centro A120 Distribucion Pilar' },
  { documentNumber: '7600001328', description: 'HIERRO LISO 10MM CORT.', preparedQuantity: '0.000', preparedUnit: 'KG', actualWeightKg: '0.000', missingReason: 'S1', warehouse: 'NAVE1S', confirmedWeightKg: '100.000', packageType: 'A1', destinationCode: 'A120', destinationName: 'Centro A120 Distribucion Pilar' },
  { documentNumber: '7600001328', description: 'CHAPA LISA NEGRA C25 1.20X2.40M CORT.', preparedQuantity: '2,040.000', preparedUnit: 'KG', actualWeightKg: '2,040.000', missingReason: 'D6', warehouse: 'NAVE1-2N', confirmedWeightKg: '2,000.000', packageType: 'A', destinationCode: 'A120', destinationName: 'Centro A120 Distribucion Pilar' },
  { documentNumber: '7600001328', description: 'METAL DESPLEGADO LIVIANO 300', preparedQuantity: '200.000', preparedUnit: 'UN', actualWeightKg: '90.000', warehouse: 'NAVE5', confirmedWeightKg: '90.000', packageType: 'A4', destinationCode: 'A120', destinationName: 'Centro A120 Distribucion Pilar' },
  { documentNumber: '7600001328', description: 'METAL DESPLEGADO LIVIANO 420', preparedQuantity: '100.000', preparedUnit: 'UN', actualWeightKg: '66.000', warehouse: 'NAVE5', confirmedWeightKg: '66.000', packageType: 'A4', destinationCode: 'A120', destinationName: 'Centro A120 Distribucion Pilar' },
  { documentNumber: '7600001328', description: 'TORNILLO AUTOPERF. TEL 14 X 1', preparedQuantity: '0.000', preparedUnit: 'UN', actualWeightKg: '0.000', missingReason: 'S1', warehouse: 'NAVE6N', confirmedWeightKg: '10.000', packageType: 'X', destinationCode: 'A120', destinationName: 'Centro A120 Distribucion Pilar' },
  { documentNumber: '7600001328', description: 'TORNILLO AUTOPERF. TEL 14 X 2', preparedQuantity: '0.000', preparedUnit: 'UN', actualWeightKg: '0.000', missingReason: 'S1', warehouse: 'NAVE6N', confirmedWeightKg: '10.000', packageType: 'X', destinationCode: 'A120', destinationName: 'Centro A120 Distribucion Pilar' },
  { documentNumber: '7600001334', description: 'CHAPA LISA AZUL M. C25 1.20X2.40M CORT.', preparedQuantity: '1.000', preparedUnit: 'UN', actualWeightKg: '12.800', warehouse: 'NAVE1-2N', confirmedWeightKg: '12.800', packageType: 'A', destinationCode: 'A120', destinationName: 'Centro A120 Distribucion Pilar' },
  { documentNumber: '7600001327', description: 'CLAVO PUNTA PARIS 1 1/2 X 10 KG SERIN', preparedQuantity: '500.000', preparedUnit: 'KG', actualWeightKg: '500.000', warehouse: 'NAVE5S', confirmedWeightKg: '500.000', packageType: 'X', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001327', description: 'CANO ESTR. CUAD. 10X10 1.2MM', preparedQuantity: '109.000', preparedUnit: 'KG', actualWeightKg: '109.000', missingReason: 'S3', warehouse: 'NAVE3S', confirmedWeightKg: '100.000', packageType: 'A3', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001327', description: 'CHAPA LAM. EN CALIENTE 4.75 1500 X 3000', preparedQuantity: '10.000', preparedUnit: 'UN', actualWeightKg: '1,680.000', warehouse: 'NAVE1-2N', confirmedWeightKg: '1,680.000', packageType: 'A', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001327', description: 'PLANCHUELA PER.CUAD 1/2X 11/4X3/16 SERIN', preparedQuantity: '75.000', preparedUnit: 'UN', actualWeightKg: '531.750', warehouse: 'NAVE3N', confirmedWeightKg: '531.750', packageType: 'X', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001327', description: 'ROLLO TEJIDO 150-63-14 1/2 SERIN', preparedQuantity: '50.000', preparedUnit: 'UN', actualWeightKg: '615.000', warehouse: 'NAVE6S', confirmedWeightKg: '615.000', packageType: 'X', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001327', description: 'CHAPA LAM. EN CALIENTE 14 1245 X 2440', preparedQuantity: '0.000', preparedUnit: 'KG', actualWeightKg: '0.000', missingReason: 'D4', warehouse: 'NAVE1-2N', confirmedWeightKg: '472.000', packageType: 'A', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001327', description: 'CHAPA LAM. EN FRIO 16 1220 X 2440', preparedQuantity: '13.000', preparedUnit: 'UN', actualWeightKg: '483.600', warehouse: 'NAVE1-2N', confirmedWeightKg: '500.000', packageType: 'A', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001327', description: 'ALAMBRE RECOCIDO C12 X50KG SERIN', preparedQuantity: '500.000', preparedUnit: 'KG', actualWeightKg: '500.000', warehouse: 'NAVE6S', confirmedWeightKg: '500.000', packageType: 'X', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001327', description: 'ALAMBRE GALVA C12 BOBINA SERIN', preparedQuantity: '925.000', preparedUnit: 'KG', actualWeightKg: '925.000', warehouse: 'NAVEP', confirmedWeightKg: '1,000.000', packageType: 'X', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001329', description: 'ALAMBRE GALVA. C12 X50KG SERIN', preparedQuantity: '0.000', preparedUnit: 'KG', actualWeightKg: '0.000', missingReason: 'S1', warehouse: 'NAVE6S', confirmedWeightKg: '500.000', packageType: 'X', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001329', description: 'ALAMBRE RECOCIDO C16 X 1KG SERIN', preparedQuantity: '2,400.000', preparedUnit: 'KG', actualWeightKg: '2,400.000', warehouse: 'NAVE6S', confirmedWeightKg: '2,400.000', packageType: 'X', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001329', description: 'ALAMBRE RECOCIDO C8 X50KG SERIN', preparedQuantity: '100.000', preparedUnit: 'KG', actualWeightKg: '100.000', warehouse: 'NAVE6S', confirmedWeightKg: '100.000', packageType: 'X', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001329', description: 'ALAMBRE RECOCIDO C12 X50KG SERIN', preparedQuantity: '100.000', preparedUnit: 'KG', actualWeightKg: '100.000', warehouse: 'NAVE6S', confirmedWeightKg: '100.000', packageType: 'X', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001329', description: 'MALLA NEGRA 50X50X2.6MM SERIN', preparedQuantity: '100.000', preparedUnit: 'UN', actualWeightKg: '582.000', missingReason: 'D4', warehouse: 'NAVE4S', confirmedWeightKg: '1,770.000', packageType: 'A4', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001329', description: 'CHAPA GALVA. LISA 25 1220 X 2440', preparedQuantity: '2,660.000', preparedUnit: 'KG', actualWeightKg: '2,660.000', missingReason: 'D6', warehouse: 'NAVE1-2N', confirmedWeightKg: '2,000.000', packageType: 'A', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001329', description: 'CHAPA LAM. EN CALIENTE 14 1245 X 2440', preparedQuantity: '0.000', preparedUnit: 'KG', actualWeightKg: '0.000', missingReason: 'D4', warehouse: 'NAVE1-2N', confirmedWeightKg: '2,000.000', packageType: 'A', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001329', description: 'CHAPA LAM. EN FRIO 18 1220 X 2440', preparedQuantity: '68.000', preparedUnit: 'UN', actualWeightKg: '2,003.960', warehouse: 'NAVE1-2N', confirmedWeightKg: '2,000.000', packageType: 'A', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001329', description: 'PLANCHUELA 3/4 X 1/8', preparedQuantity: '507.000', preparedUnit: 'KG', actualWeightKg: '507.000', missingReason: 'S3', warehouse: 'NAVE3N', confirmedWeightKg: '500.000', packageType: 'A2', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001329', description: 'PLANCHUELA 3/4 X 3/16', preparedQuantity: '504.000', preparedUnit: 'KG', actualWeightKg: '504.000', missingReason: 'S3', warehouse: 'NAVE3N', confirmedWeightKg: '500.000', packageType: 'A2', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001329', description: 'PLANCHUELA GALVA. 1.50 MTS. SERIN', preparedQuantity: '0.000', preparedUnit: 'UN', actualWeightKg: '0.000', missingReason: 'S1', warehouse: 'NAVE6S', confirmedWeightKg: '142.000', packageType: 'X', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001329', description: 'PLANCHUELA GALVA 1.80 MTS. SERIN', preparedQuantity: '0.000', preparedUnit: 'UN', actualWeightKg: '0.000', missingReason: 'S1', warehouse: 'NAVE6S', confirmedWeightKg: '342.000', packageType: 'X', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001329', description: 'PLANCHUELA GALVA. 2 MTS. SERIN', preparedQuantity: '0.000', preparedUnit: 'UN', actualWeightKg: '0.000', missingReason: 'S1', warehouse: 'NAVE6S', confirmedWeightKg: '190.000', packageType: 'X', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001329', description: 'ANGULO 2 X 3/16', preparedQuantity: '1,006.000', preparedUnit: 'KG', actualWeightKg: '1,006.000', missingReason: 'S3', warehouse: 'NAVE3N', confirmedWeightKg: '1,000.000', packageType: 'A2', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001329', description: 'TORNIQUETA GOLONDRINA N7', preparedQuantity: '0.000', preparedUnit: 'UN', actualWeightKg: '0.000', missingReason: 'S1', warehouse: 'NAVE5S', confirmedWeightKg: '58.000', packageType: 'X', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001333', description: 'ANGULO 1 1/2 X 3/16', preparedQuantity: '1,953.000', preparedUnit: 'KG', actualWeightKg: '1,953.000', missingReason: 'D6', warehouse: 'NAVE3N', confirmedWeightKg: '2,000.000', packageType: 'A2', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001333', description: 'ANGULO 1 1/4 X 1/8', preparedQuantity: '2,065.000', preparedUnit: 'KG', actualWeightKg: '2,065.000', missingReason: 'D6', warehouse: 'NAVE3N', confirmedWeightKg: '2,000.000', packageType: 'A2', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '7600001333', description: 'ANGULO 1 3/4 X 1/8', preparedQuantity: '1,074.000', preparedUnit: 'KG', actualWeightKg: '1,074.000', missingReason: 'S1', warehouse: 'NAVE3N', confirmedWeightKg: '2,000.000', packageType: 'A2', destinationCode: 'B120', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '1000058758', description: 'escaleras. PC 1135', preparedQuantity: '3.000', preparedUnit: 'UN', actualWeightKg: '33.000', confirmedWeightKg: '0.000', packageType: 'X', destinationCode: '3200000348', destinationName: 'Centro B120 Distribucion Pilar' },
  { documentNumber: '1000058470', description: 'bultos con filtros. PC 990', preparedQuantity: '5.000', preparedUnit: 'UN', actualWeightKg: '12.000', confirmedWeightKg: '0.000', packageType: 'X', destinationCode: '3200000352', destinationName: 'Centro B410 Produccion Ramallo' },
  { documentNumber: '1000058246', description: '2 cajas con dispenser. PC 1083', preparedQuantity: '2.000', preparedUnit: 'UN', actualWeightKg: '5.000', confirmedWeightKg: '0.000', packageType: 'X', destinationCode: '3200000354', destinationName: 'Centro B510 Produccion Lomas' },
];

const excludedSerinProductCodes = new Set(['7600001329-22']);

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    await resetDemoData(prisma);

    const loadingPlansService = new LoadingPlansService(prisma, new AuditService(prisma));
    const catalog = await createCatalog(prisma);
    const customers = await createCustomers(prisma);
    const orders = await createOrders(prisma, customers, catalog);
    const deliveryPlan = await createDeliveryPlan(prisma);
    const readyDispatch = await createReadyDispatch(prisma, orders.ready, deliveryPlan.id);
    const plannedDispatch = await createPlannedDispatch(prisma, orders.planned, deliveryPlan.id);
    const linkedOperation = await createLinkedLoadOperation(prisma, readyDispatch.id, catalog);

    await loadingPlansService.generate(linkedOperation.id);

    const auditCount = await prisma.auditEvent.count();
    const linkedOperationDetail = await prisma.loadOperation.findUniqueOrThrow({
      where: { id: linkedOperation.id },
      include: { plans: { where: { isCurrent: true }, include: { metrics: true } } },
    });
    const currentPlan = linkedOperationDetail.plans[0];

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
        readyDispatch: DispatchOrderStatus.LOAD_OPERATION_LINKED,
        plannedDispatch: plannedDispatch.status,
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
      planner: currentPlan ? {
        planId: currentPlan.id,
        version: currentPlan.version,
        status: currentPlan.status,
        placedItems: currentPlan.metrics?.placedItemCount ?? 0,
        unplacedItems: currentPlan.metrics?.unplacedItemCount ?? 0,
        criticalAlerts: currentPlan.metrics?.criticalAlertCount ?? 0,
        warningAlerts: currentPlan.metrics?.warningAlertCount ?? 0,
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
    prisma.$executeRawUnsafe('DELETE FROM "AxleLoadSnapshot"'),
    prisma.loadingStep.deleteMany(),
    prisma.unplacedItem.deleteMany(),
    prisma.placedItem.deleteMany(),
    prisma.planMetrics.deleteMany(),
    prisma.loadingPlan.deleteMany(),
    prisma.loadProduct.deleteMany(),
    prisma.destination.deleteMany(),
    prisma.truckZone.deleteMany(),
    prisma.$executeRawUnsafe('DELETE FROM "AxleGroup"'),
    prisma.$executeRawUnsafe('DELETE FROM "LoadingLayer"'),
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

  const serinProducts = [];
  for (const { row, code } of preparedSerinRowsWithCodes()) {
    if (excludedSerinProductCodes.has(code)) continue;

    const shape = inferProductShape(row);
    serinProducts.push(await prisma.productCatalog.create({
      data: productCatalog(code, shape.family, row.description, parseSheetNumber(row.actualWeightKg), shape.lengthMm, shape.widthMm, shape.heightMm, shape.stackable, shape.rotationAllowed),
    }));
  }

  return { truck, trailer, destinations: { rosario, villaGalvez, sanNicolas }, products: { profile, sheet, tube, pallet, serin: serinProducts } };
}

async function createCustomers(prisma: PrismaService) {
  const [acerosNorte, metalurgicaSur] = await Promise.all([
    prisma.customer.create({ data: { code: CODES.customers[0], name: 'Aceros del Norte SA', taxId: '30-71111111-7', notes: 'Cliente activo con pedidos liberados para dispatch.' } }),
    prisma.customer.create({ data: { code: CODES.customers[1], name: 'Metalurgica Sur SRL', taxId: '30-72222222-8', notes: 'Cliente demo con pedido bloqueado por credito.' } }),
  ]);

  await Promise.all([acerosNorte, metalurgicaSur].map((customer) => audit(prisma, AuditAction.CREATED, 'Customer', customer.id, customer.code, undefined, { status: customer.status })));
  return { acerosNorte, metalurgicaSur };
}

async function createOrders(prisma: PrismaService, customers: Awaited<ReturnType<typeof createCustomers>>, catalog: Awaited<ReturnType<typeof createCatalog>>) {
  const ready = await prisma.order.create({
    data: {
      code: CODES.orders[0],
      customerId: customers.acerosNorte.id,
      status: OrderStatus.RELEASED,
      creditStatus: CreditStatus.RELEASED,
      sellerPriority: SellerPriority.URGENT,
      destinationCatalogId: catalog.destinations.rosario.id,
      destinationName: catalog.destinations.rosario.name,
      requestedDeliveryAt: new Date('2026-05-21T10:00:00.000Z'),
      externalRef: 'OC-ACN-9821',
      notes: 'Pedido liberado que recorre dispatch -> reserva -> preparacion -> aduana -> carga -> planner.',
      items: {
        create: [
          orderItem(catalog.products.profile.id, CODES.products[0], 'Perfiles para nave Rosario', 4),
          orderItem(catalog.products.pallet.id, CODES.products[3], 'Pallet complementario Rosario', 1),
          ...catalog.products.serin.map((product) => orderItem(product.id, product.code, product.description ?? product.code, 1)),
        ],
      },
    },
    include: { items: true },
  });

  const blocked = await prisma.order.create({
    data: {
      code: CODES.orders[1],
      customerId: customers.metalurgicaSur.id,
      status: OrderStatus.CREDIT_HELD,
      creditStatus: CreditStatus.HELD,
      sellerPriority: SellerPriority.HIGH,
      destinationCatalogId: catalog.destinations.villaGalvez.id,
      destinationName: catalog.destinations.villaGalvez.name,
      requestedDeliveryAt: new Date('2026-05-21T14:00:00.000Z'),
      externalRef: 'OC-MTS-1044',
      notes: 'Pedido bloqueado: queda fuera de demanda dispatch hasta liberar credito.',
      items: { create: [orderItem(catalog.products.sheet.id, CODES.products[1], 'Chapas para VGG retenidas por credito', 3)] },
    },
    include: { items: true },
  });

  const planned = await prisma.order.create({
    data: {
      code: CODES.orders[2],
      customerId: customers.acerosNorte.id,
      status: OrderStatus.RELEASED,
      creditStatus: CreditStatus.RELEASED,
      sellerPriority: SellerPriority.NORMAL,
      destinationCatalogId: catalog.destinations.sanNicolas.id,
      destinationName: catalog.destinations.sanNicolas.name,
      requestedDeliveryAt: new Date('2026-05-22T09:00:00.000Z'),
      externalRef: 'OC-ACN-9822',
      notes: 'Pedido liberado con dispatch PLANNED para demostrar los gates pendientes.',
      items: { create: [orderItem(catalog.products.tube.id, CODES.products[2], 'Tubos para San Nicolas', 5)] },
    },
    include: { items: true },
  });

  await Promise.all([
    audit(prisma, AuditAction.CREATED, 'Order', ready.id, ready.code, undefined, { status: OrderStatus.RECEIVED, creditStatus: CreditStatus.PENDING, itemCount: ready.items.length }),
    audit(prisma, AuditAction.CREDIT_RELEASED, 'Order', ready.id, ready.code, { status: OrderStatus.RECEIVED, creditStatus: CreditStatus.PENDING }, { status: ready.status, creditStatus: ready.creditStatus }),
    audit(prisma, AuditAction.CREATED, 'Order', blocked.id, blocked.code, undefined, { status: OrderStatus.RECEIVED, creditStatus: CreditStatus.PENDING, itemCount: blocked.items.length }),
    audit(prisma, AuditAction.CREDIT_HELD, 'Order', blocked.id, blocked.code, { status: OrderStatus.RECEIVED, creditStatus: CreditStatus.PENDING }, { status: blocked.status, creditStatus: blocked.creditStatus }),
    audit(prisma, AuditAction.CREATED, 'Order', planned.id, planned.code, undefined, { status: OrderStatus.RECEIVED, creditStatus: CreditStatus.PENDING, itemCount: planned.items.length }),
    audit(prisma, AuditAction.CREDIT_RELEASED, 'Order', planned.id, planned.code, { status: OrderStatus.RECEIVED, creditStatus: CreditStatus.PENDING }, { status: planned.status, creditStatus: planned.creditStatus }),
  ]);

  return { ready, blocked, planned };
}

async function createDeliveryPlan(prisma: PrismaService) {
  const deliveryPlan = await prisma.deliveryPlan.create({
    data: {
      code: CODES.deliveryPlan,
      plannedDate: new Date('2026-05-21T08:00:00.000Z'),
      notes: 'Plan demo: dos pedidos liberados y un pedido bloqueado por credito para mostrar el gate comercial.',
    },
  });
  await audit(prisma, AuditAction.CREATED, 'DeliveryPlan', deliveryPlan.id, deliveryPlan.code, undefined, { status: deliveryPlan.status });
  return deliveryPlan;
}

async function createReadyDispatch(prisma: PrismaService, order: Awaited<ReturnType<typeof createOrders>>['ready'], deliveryPlanId: string) {
  const dispatch = await createDispatchWithItems(prisma, order, deliveryPlanId, CODES.dispatchOrders[0], DispatchOrderStatus.LOAD_OPERATION_LINKED, 'Dispatch demo completo: reserva, preparacion, aduana, transporte y operacion de carga enlazada.');
  const reservation = await createReservationAndPreparation(prisma, dispatch.id, ReservationStatus.RELEASED, PreparationStatus.READY);

  await prisma.customsRelease.create({ data: { dispatchOrderId: dispatch.id, status: CustomsReleaseStatus.CLEARED, externalRef: 'ADU-CLR-9821', clearedAt: new Date('2026-05-20T18:00:00.000Z'), notes: 'Liberacion aduanera lista para carga.' } });
  await prisma.transportExit.create({ data: { dispatchOrderId: dispatch.id, status: TransportExitStatus.AUTHORIZED_EXIT, externalRef: 'TRP-9821', docsReadyAt: new Date('2026-05-20T19:00:00.000Z'), scaleWeightKg: 3120, scaledAt: new Date('2026-05-21T07:40:00.000Z'), authorizedAt: new Date('2026-05-21T07:50:00.000Z'), notes: 'Transporte autorizado, pendiente despacho final.' } });

  await Promise.all([
    audit(prisma, AuditAction.CREATED, 'DispatchOrder', dispatch.id, dispatch.code, undefined, { status: DispatchOrderStatus.PLANNED, itemCount: dispatch.items.length }),
    audit(prisma, AuditAction.STATUS_CHANGED, 'Reservation', reservation.id, undefined, { status: ReservationStatus.PENDING }, { status: reservation.status }),
    audit(prisma, AuditAction.STATUS_CHANGED, 'Preparation', reservation.preparation!.id, undefined, { status: PreparationStatus.PICKING }, { status: PreparationStatus.READY }),
    audit(prisma, AuditAction.STATUS_CHANGED, 'CustomsRelease', dispatch.id, dispatch.code, { status: CustomsReleaseStatus.PENDING }, { status: CustomsReleaseStatus.CLEARED }),
    audit(prisma, AuditAction.READY_TO_LOAD, 'DispatchOrder', dispatch.id, dispatch.code, { status: DispatchOrderStatus.PLANNED }, { status: DispatchOrderStatus.READY_TO_LOAD }),
  ]);

  return dispatch;
}

async function createPlannedDispatch(prisma: PrismaService, order: Awaited<ReturnType<typeof createOrders>>['planned'], deliveryPlanId: string) {
  const dispatch = await createDispatchWithItems(prisma, order, deliveryPlanId, CODES.dispatchOrders[1], DispatchOrderStatus.PLANNED, 'Dispatch liberado pero con preparacion/aduana pendientes para probar gates desde el frontend.');
  await createReservationAndPreparation(prisma, dispatch.id, ReservationStatus.RESERVED, PreparationStatus.PICKING);
  await prisma.customsRelease.create({ data: { dispatchOrderId: dispatch.id, status: CustomsReleaseStatus.PENDING, notes: 'Pendiente documentacion aduanera.' } });
  await prisma.transportExit.create({ data: { dispatchOrderId: dispatch.id, status: TransportExitStatus.PENDING, notes: 'Pendiente documentacion y balanza.' } });
  await audit(prisma, AuditAction.CREATED, 'DispatchOrder', dispatch.id, dispatch.code, undefined, { status: dispatch.status, itemCount: dispatch.items.length });
  return dispatch;
}

async function createDispatchWithItems(prisma: PrismaService, order: Awaited<ReturnType<typeof createOrders>>['ready'], deliveryPlanId: string, code: string, status: DispatchOrderStatus, notes: string) {
  const orderWithItems = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: { include: { productCatalog: true } } } });
  return prisma.dispatchOrder.create({
    data: {
      code,
      status,
      orderId: order.id,
      deliveryPlanId,
      destinationCatalogId: order.destinationCatalogId,
      destinationNameSnapshot: order.destinationName,
      sellerPriority: order.sellerPriority,
      requestedDeliveryAt: order.requestedDeliveryAt,
      notes,
      items: {
        create: orderWithItems.items.map((item) => ({
          orderItemId: item.id,
          productCatalogId: item.productCatalogId!,
          productCodeSnapshot: item.productCode,
          descriptionSnapshot: item.description,
          quantity: item.quantity,
          weightKg: item.weightKg ?? item.productCatalog?.weightKg,
          lengthMm: item.lengthMm ?? item.productCatalog?.lengthMm,
          widthMm: item.widthMm ?? item.productCatalog?.widthMm,
          heightMm: item.heightMm ?? item.productCatalog?.heightMm,
        })),
      },
    },
    include: { items: true },
  });
}

async function createReservationAndPreparation(prisma: PrismaService, dispatchOrderId: string, reservationStatus: ReservationStatus, preparationStatus: PreparationStatus) {
  const dispatchItems = await prisma.dispatchOrderItem.findMany({ where: { dispatchOrderId }, orderBy: { createdAt: 'asc' } });
  const reservation = await prisma.reservation.create({
    data: {
      dispatchOrderId,
      status: reservationStatus,
      requestedQuantity: dispatchItems.reduce((sum, item) => sum + item.quantity, 0),
      reservedQuantity: dispatchItems.reduce((sum, item) => sum + item.quantity, 0),
      unreservedQuantity: 0,
      externalRef: `RES-${dispatchOrderId.slice(0, 8).toUpperCase()}`,
      releasedAt: reservationStatus === ReservationStatus.RELEASED ? new Date('2026-05-20T16:30:00.000Z') : undefined,
      items: {
        create: dispatchItems.map((item) => ({
          dispatchOrderItemId: item.id,
          productCatalogId: item.productCatalogId,
          productCodeSnapshot: item.productCodeSnapshot,
          requestedQuantity: item.quantity,
          availableQuantity: item.quantity,
          reservedQuantity: item.quantity,
          unreservedQuantity: 0,
        })),
      },
    },
    include: { items: true },
  });

  const readyQuantity = preparationStatus === PreparationStatus.READY ? reservation.reservedQuantity : Math.max(0, reservation.reservedQuantity - 1);
  const preparation = await prisma.preparation.create({
    data: {
      reservationId: reservation.id,
      dispatchOrderId,
      status: preparationStatus,
      requestedQuantity: reservation.requestedQuantity,
      reservedQuantity: reservation.reservedQuantity,
      readyQuantity,
      discrepancyQuantity: 0,
      completedAt: preparationStatus === PreparationStatus.READY ? new Date('2026-05-20T17:15:00.000Z') : undefined,
      notes: preparationStatus === PreparationStatus.READY ? 'Preparacion completa sin discrepancias.' : 'Preparacion en curso para mostrar el gate de loading.',
      items: {
        create: reservation.items.map((item, index) => ({
          reservationItemId: item.id,
          productCodeSnapshot: item.productCodeSnapshot,
          reservedQuantity: item.reservedQuantity,
          readyQuantity: preparationStatus === PreparationStatus.READY || index > 0 ? item.reservedQuantity : Math.max(0, item.reservedQuantity - 1),
          discrepancyQuantity: 0,
        })),
      },
    },
  });

  return { ...reservation, preparation };
}

async function createLinkedLoadOperation(prisma: PrismaService, dispatchOrderId: string, catalog: Awaited<ReturnType<typeof createCatalog>>) {
  const dispatch = await prisma.dispatchOrder.findUniqueOrThrow({
    where: { id: dispatchOrderId },
    include: { destinationCatalog: true, items: { include: { productCatalog: true } } },
  });

  const operation = await prisma.loadOperation.create({
    data: {
      code: `OP-${CODES.dispatchOrders[0]}`,
      name: `Carga ${dispatch.code}`,
      notes: 'Operacion creada por seed lifecycle desde despacho listo para carga.',
      scheduledAt: dispatch.requestedDeliveryAt,
    },
  });

  await prisma.dispatchOrder.update({ where: { id: dispatchOrderId }, data: { loadOperationId: operation.id } });
  await audit(prisma, AuditAction.LOAD_OPERATION_CREATED, 'DispatchOrder', dispatch.id, dispatch.code, { status: DispatchOrderStatus.READY_TO_LOAD, loadOperationId: null }, { status: DispatchOrderStatus.LOAD_OPERATION_LINKED, loadOperationId: operation.id }, 'LoadOperation', operation.id);

  const destination = await prisma.destination.create({
    data: {
      operationId: operation.id,
      code: dispatch.destinationCatalog?.code,
      name: dispatch.destinationNameSnapshot ?? dispatch.destinationCatalog?.name ?? 'Sin destino',
      address: dispatch.destinationCatalog?.address,
      notes: dispatch.destinationCatalog?.notes,
      unloadingOrder: 1,
    },
  });

  const destinationAssignment = await prisma.operationDestinationAssignment.create({
    data: { operationId: operation.id, destinationCatalogId: catalog.destinations.rosario.id, unloadingOrder: 1, notes: 'Asignacion creada por seed lifecycle.' },
  });

  await prisma.loadProduct.createMany({
    data: dispatch.items.map((item) => ({
      operationId: operation.id,
      destinationId: destination.id,
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

  for (const item of dispatch.items) {
    await prisma.operationProductAssignment.create({
      data: {
        operationId: operation.id,
        productCatalogId: item.productCatalogId,
        operationDestinationId: destinationAssignment.id,
        quantity: item.quantity,
        weightKgOverride: item.weightKg,
        lengthMmOverride: item.lengthMm,
        widthMmOverride: item.widthMm,
        heightMmOverride: item.heightMm,
        stackableOverride: item.productCatalog.stackable,
        rotationAllowedOverride: item.productCatalog.rotationAllowed,
        notes: item.descriptionSnapshot,
      },
    });
  }

  await attachTruck(prisma, operation.id, catalog);
  return operation;
}

async function attachTruck(prisma: PrismaService, operationId: string, catalog: Awaited<ReturnType<typeof createCatalog>>) {
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
      zones: { create: catalog.truck.zoneTemplates.map(({ type, name, maxWeightKg, startXMm, endXMm, startYMm, endYMm }) => ({ type, name, maxWeightKg, startXMm, endXMm, startYMm, endYMm })) },
    },
  });

  await prisma.operationVehicleAssignment.create({
    data: {
      operationId,
      truckCatalogId: catalog.truck.id,
      trailerCatalogId: catalog.trailer.id,
      notes: 'Asignacion creada por seed lifecycle para sincronizar catalogo y planner runtime.',
      zones: { create: catalog.truck.zoneTemplates.map((zone) => ({ zoneTemplateId: zone.id, type: zone.type, name: zone.name, maxWeightKg: zone.maxWeightKg, startXMm: zone.startXMm, endXMm: zone.endXMm, startYMm: zone.startYMm, endYMm: zone.endYMm })) },
    },
  });

  await createLoadingDefaults(prisma, truck.id);
}

async function createLoadingDefaults(prisma: PrismaService, truckId: string) {
  const layerHeightMm = 2700 / 6;
  for (let index = 0; index < 6; index += 1) {
    const number = index + 1;
    await prisma.$executeRaw`
      INSERT INTO "LoadingLayer" ("id", "truckId", "number", "label", "groupLabel", "minZMm", "maxZMm", "notes", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${truckId}, ${number}, ${`Capa ${number}`}, ${number <= 3 ? 'Capas inferiores' : 'Capas superiores'}, ${Math.round(index * layerHeightMm)}, ${Math.round((index + 1) * layerHeightMm)}, ${'Demo lifecycle: capas genericas para diagnostico de planner.'}, NOW(), NOW())
    `;
  }

  for (const group of [
    { code: 'DEMO-FRONT', label: 'Eje delantero demo', startXMm: 0, endXMm: 4533, maxWeightKg: 9000 },
    { code: 'DEMO-REAR', label: 'Ejes traseros demo', startXMm: 4533, endXMm: 13600, maxWeightKg: 19000 },
  ]) {
    await prisma.$executeRaw`
      INSERT INTO "AxleGroup" ("id", "truckId", "code", "label", "startXMm", "endXMm", "maxWeightKg", "source", "notes", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${truckId}, ${group.code}, ${group.label}, ${group.startXMm}, ${group.endXMm}, ${group.maxWeightKg}, ${'seed:lifecycle'}, ${'Limites demo no legales; usar solo para diagnostico UX.'}, NOW(), NOW())
    `;
  }
}

async function audit(prisma: PrismaService, action: AuditAction, entityType: string, entityId: string, entityCode?: string, before?: object, after?: object, relatedEntityType?: string, relatedEntityId?: string) {
  await prisma.auditEvent.create({
    data: { actor: SEED_ACTOR, source: AuditSource.SYSTEM, action, entityType, entityId, entityCode, before, after, relatedEntityType, relatedEntityId },
  });
}

function defaultZones() {
  return [
    { type: TruckZoneType.CABIN_SIDE, name: 'Tercio delantero / cabina', maxWeightKg: 9500, startXMm: 0, endXMm: 4533, startYMm: 0, endYMm: 2480 },
    { type: TruckZoneType.CENTER, name: 'Tercio central', maxWeightKg: 9500, startXMm: 4533, endXMm: 9066, startYMm: 0, endYMm: 2480 },
    { type: TruckZoneType.DOOR_SIDE, name: 'Tercio trasero / puerta', maxWeightKg: 9000, startXMm: 9066, endXMm: 13600, startYMm: 0, endYMm: 2480 },
  ];
}

function preparedSerinRowsWithCodes() {
  return serinRows
    .filter((row) => parseSheetNumber(row.actualWeightKg) > 0)
    .map((row, index) => ({
      row,
      code: `${row.documentNumber}-${String(index + 1).padStart(2, '0')}`,
    }));
}

function inferProductShape(row: SheetRow): ProductShape {
  const description = row.description.toUpperCase();
  const packageType = row.packageType?.toUpperCase();

  if (description.includes('CHAPA') || description.includes('LISA') || description.includes('METAL DESPLEGADO') || description.includes('MALLA')) {
    return { family: ProductFamily.SHEET, lengthMm: description.includes('3000') ? 3000 : 2440, widthMm: description.includes('1500') ? 1500 : 1220, heightMm: packageType === 'A4' ? 450 : 300, stackable: true, rotationAllowed: true };
  }

  if (description.includes('ALAMBRE') || description.includes('ROLLO') || description.includes('MEMB.')) {
    return { family: ProductFamily.COIL, lengthMm: 1200, widthMm: 1000, heightMm: 900, stackable: false, rotationAllowed: true };
  }

  if (description.includes('ANGULO') || description.includes('PLANCHUELA') || description.includes('HIERRO') || description.includes('CANO') || description.includes('CAÑO')) {
    return { family: ProductFamily.PROFILE, lengthMm: 6000, widthMm: packageType === 'A2' ? 550 : 450, heightMm: 450, stackable: true, rotationAllowed: false };
  }

  if (description.includes('TORNILLO') || description.includes('CLAVO') || description.includes('CAJA') || description.includes('FILTRO') || description.includes('DISPENSER')) {
    return { family: ProductFamily.GENERIC_PACKAGE, lengthMm: 1200, widthMm: 1000, heightMm: 900, stackable: true, rotationAllowed: true };
  }

  if (description.includes('ESCALERA')) {
    return { family: ProductFamily.GENERIC_PACKAGE, lengthMm: 2500, widthMm: 600, heightMm: 300, stackable: true, rotationAllowed: true };
  }

  return { family: ProductFamily.GENERIC_PACKAGE, lengthMm: 1200, widthMm: 1000, heightMm: 800, stackable: false, rotationAllowed: true };
}

function parseSheetNumber(value: string) {
  return Number(value.replace(/,/g, ''));
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
