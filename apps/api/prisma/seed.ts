import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { LoadingMethod, PrismaClient, ProductFamily, TruckZoneType } from '@prisma/client';

const WEB_BASE_URL = 'http://localhost:5173';

const DEMO = {
  operationCode: 'OP-SERIN-PLANILLA-001',
  truckPlate: 'SERIN-P2-DEMO-01',
};

const SERIN_P2_DEMO_AXLE_PROFILE = {
  code: 'SERIN_P2_DEMO_FROM_DIAGRAM',
  source: 'SERIN_P2_DEMO_FROM_DIAGRAM: notas visibles del diagrama provisto por el usuario con referencia a Decreto 32/18 Art. 27; tabla oficial completa pendiente de validacion.',
  notes: 'Perfil configurable para demo. No declarar cumplimiento legal hasta contrastar contra fuente oficial completa por tipo de vehiculo.',
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

const rows: SheetRow[] = [
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

const excludedLoadProductCodes = new Set(['7600001329-22']);

async function main() {
  const prisma = new PrismaClient();

  try {
    await resetDatabase(prisma);
    const operation = await createSerinSheetDemo(prisma);
    const preparedRows = preparedRowsWithCodes().filter(({ code }) => !excludedLoadProductCodes.has(code)).map(({ row }) => row);

    console.log(JSON.stringify({
      message: 'Serin sheet seed loaded',
      action: 'Abrir el planner y tocar "Generar plan" para probar la planilla real con destinos multiples.',
      codes: {
        operation: operation.code,
        truck: DEMO.truckPlate,
      },
      source: {
        rows: rows.length,
        preparedRows: preparedRows.length,
        totalPreparedWeightKg: round3(preparedRows.reduce((sum, row) => sum + parseSheetNumber(row.actualWeightKg), 0)),
      },
      demoSupport: {
        loadingLayersEnabled: true,
        axleSnapshotsEnabled: true,
        axleProfile: SERIN_P2_DEMO_AXLE_PROFILE.code,
        legalValidation: 'PENDIENTE: limites demo desde diagrama; falta validar tabla oficial completa Decreto 32/18 por tipo de vehiculo.',
      },
      frontendPaths: {
        operations: `${WEB_BASE_URL}/operations`,
        operation: `${WEB_BASE_URL}/operations/${operation.id}`,
        planner: `${WEB_BASE_URL}/operations/${operation.id}/planner`,
      },
      modelingNotes: [
        'Cada fila preparada se carga como 1 bulto/linea con el Peso Real total de la planilla.',
        'La descripcion visible del producto queda limpia; datos de planilla como nave, bultos y pesos se mantienen en el seed para modelado, no en el nombre mostrado.',
        'Capas fisicas 1 a 12 y grupos de ejes P2 demo cargados. Los limites de ejes usan perfil SERIN_P2_DEMO_FROM_DIAGRAM y NO constituyen validacion legal completa.',
      ],
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function resetDatabase(prisma: PrismaClient) {
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

async function createSerinSheetDemo(prisma: PrismaClient) {
  const truckZones = serinTruckZones();
  const operation = await prisma.loadOperation.create({
    data: {
      code: DEMO.operationCode,
      name: 'Demo Serin - planilla real multipunto',
      notes: [
        'Seed basado en planilla Serin de preparacion y diagramas de carga por capas 1 a 12.',
        'Las imagenes dividen la diagramacion en capas de 4 en 4. El modelo actual representa una planta 2D con zonas longitudinales, no capas fisicas.',
        'Referencia regulatoria provista por diagrama: PESOS POR EJE SEGUN ART. 27 DEL DECRETO N 32/18 DIREC NAC VIALIDAD. P2 observado: 8/22 TN y 12/18 TN segun columna del diagrama; tabla oficial completa pendiente de validacion.',
      ].join(' '),
      scheduledAt: new Date('2026-05-27T09:00:00.000Z'),
      truck: {
        create: {
          plate: DEMO.truckPlate,
          description: 'Semirremolque P2 demo 14.5m para planilla Serin. Capacidad total 30 TN; limites de ejes documentados en notas, no evaluados estructuralmente por el schema actual.',
          loadingMethod: LoadingMethod.REAR,
          maxPayloadKg: 30000,
          lengthMm: 14500,
          widthMm: 2400,
          heightMm: 2600,
          zones: {
            create: truckZones,
          },
        },
      },
    },
  });

  const truck = await prisma.truck.findUniqueOrThrow({
    where: { operationId: operation.id },
    select: { id: true },
  });

  await createSerinP2LoadingDefaults(prisma, truck.id);
  await createSerinTruckCatalogAssignment(prisma, operation.id, truckZones);

  const { destinations, destinationAssignmentsByCode } = await createDestinations(prisma, operation.id);
  const destinationByCode = new Map(destinations.map((destination) => [destination.code, destination.id]));

  await prisma.loadProduct.createMany({
    data: preparedRowsWithCodes()
      .filter(({ code }) => !excludedLoadProductCodes.has(code))
      .map(({ row, code }) => {
        const shape = inferProductShape(row);
        return {
          operationId: operation.id,
          destinationId: destinationByCode.get(row.destinationCode),
          code,
          family: shape.family,
          description: buildProductDescription(row),
          quantity: 1,
          weightKg: parseSheetNumber(row.actualWeightKg),
          lengthMm: shape.lengthMm,
          widthMm: shape.widthMm,
          heightMm: shape.heightMm,
          stackable: shape.stackable,
          rotationAllowed: shape.rotationAllowed,
        };
      }),
  });

  await createProductCatalogAssignments(prisma, operation.id, destinationAssignmentsByCode);

  return prisma.loadOperation.findUniqueOrThrow({
    where: { id: operation.id },
    include: { truck: true, destinations: true, products: true },
  });
}

function serinTruckZones() {
  return [
    { type: TruckZoneType.CABIN_SIDE, name: 'Cabina / descarga final', maxWeightKg: 30000, startXMm: 0, endXMm: 4833, startYMm: 0, endYMm: 2400 },
    { type: TruckZoneType.CENTER, name: 'Centro', maxWeightKg: 30000, startXMm: 4833, endXMm: 9666, startYMm: 0, endYMm: 2400 },
    { type: TruckZoneType.DOOR_SIDE, name: 'Puertas / descarga inicial', maxWeightKg: 30000, startXMm: 9666, endXMm: 14500, startYMm: 0, endYMm: 2400 },
  ];
}

async function createSerinTruckCatalogAssignment(prisma: PrismaClient, operationId: string, truckZones: ReturnType<typeof serinTruckZones>) {
  const truckCatalog = await prisma.truckCatalog.create({
    data: {
      plate: DEMO.truckPlate,
      description: 'Catalogo demo Serin P2 14.5m. Replica el camion runtime del seed para que la pantalla Camion muestre vehiculo asignado.',
      loadingMethod: LoadingMethod.REAR,
      maxPayloadKg: 30000,
      lengthMm: 14500,
      widthMm: 2400,
      heightMm: 2600,
      zoneTemplates: { create: truckZones },
    },
    include: { zoneTemplates: true },
  });

  await prisma.operationVehicleAssignment.create({
    data: {
      operationId,
      truckCatalogId: truckCatalog.id,
      notes: 'Asignacion creada por seed Serin para sincronizar UI de catalogo con planner runtime.',
      zones: {
        create: truckZones.map((zone) => ({
          zoneTemplateId: truckCatalog.zoneTemplates.find((template) => template.type === zone.type)?.id,
          type: zone.type,
          name: zone.name,
          maxWeightKg: zone.maxWeightKg,
          startXMm: zone.startXMm,
          endXMm: zone.endXMm,
          startYMm: zone.startYMm,
          endYMm: zone.endYMm,
        })),
      },
    },
  });
}

async function createSerinP2LoadingDefaults(prisma: PrismaClient, truckId: string) {
  const layerHeightMm = 2600 / 12;
  for (let index = 0; index < 12; index += 1) {
    const number = index + 1;
    const groupStart = Math.floor(index / 4) * 4 + 1;
    await prisma.$executeRaw`
      INSERT INTO "LoadingLayer" ("id", "truckId", "number", "label", "groupLabel", "minZMm", "maxZMm", "notes", "createdAt", "updatedAt")
      VALUES (
        ${randomUUID()}, ${truckId}, ${number}, ${`Capa ${number}`}, ${`Capas ${groupStart}-${groupStart + 3}`},
        ${Math.round(index * layerHeightMm)}, ${Math.round((index + 1) * layerHeightMm)},
        ${'Demo Serin: diagramacion agrupada 1-4, 5-8 y 9-12.'}, NOW(), NOW()
      )
    `;
  }

  const source = SERIN_P2_DEMO_AXLE_PROFILE.source;
  const notes = SERIN_P2_DEMO_AXLE_PROFILE.notes;
  const axleGroups = [
    { code: 'P2-FRONT-8T', label: 'P2 delantero demo 8 tn', startXMm: 0, endXMm: 4833, maxWeightKg: 8000 },
    { code: 'P2-REAR-22T', label: 'P2 trasero demo 22 tn', startXMm: 4833, endXMm: 14500, maxWeightKg: 22000 },
  ];

  for (const group of axleGroups) {
    await prisma.$executeRaw`
      INSERT INTO "AxleGroup" ("id", "truckId", "code", "label", "startXMm", "endXMm", "maxWeightKg", "source", "notes", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${truckId}, ${group.code}, ${group.label}, ${group.startXMm}, ${group.endXMm}, ${group.maxWeightKg}, ${source}, ${notes}, NOW(), NOW())
    `;
  }
}

async function createDestinations(prisma: PrismaClient, operationId: string) {
  const destinationRows = uniqueBy(rows, (row) => row.destinationCode);
  const destinations = destinationRows.map((row, index) => ({
    operationId,
    code: row.destinationCode,
    name: row.destinationName,
    unloadingOrder: index + 1,
    address: row.destinationName,
    notes: `Destino importado de planilla. Codigo destinatario: ${row.destinationCode}.`,
  }));

  await prisma.destination.createMany({ data: destinations });

  const destinationAssignmentsByCode = new Map<string, string>();
  for (const [index, row] of destinationRows.entries()) {
    const catalog = await prisma.destinationCatalog.create({
      data: {
        code: row.destinationCode,
        name: row.destinationName,
        address: row.destinationName,
        notes: 'Catalogo creado por seed Serin para que la pantalla Destinos muestre la asignacion.',
      },
    });

    const assignment = await prisma.operationDestinationAssignment.create({
      data: {
        operationId,
        destinationCatalogId: catalog.id,
        unloadingOrder: index + 1,
        notes: `Asignacion de destino importada de planilla. Codigo destinatario: ${row.destinationCode}.`,
      },
    });

    destinationAssignmentsByCode.set(row.destinationCode, assignment.id);
  }

  const createdDestinations = await prisma.destination.findMany({
    where: { operationId },
    orderBy: { unloadingOrder: 'asc' },
  });

  return { destinations: createdDestinations, destinationAssignmentsByCode };
}

async function createProductCatalogAssignments(prisma: PrismaClient, operationId: string, destinationAssignmentsByCode: Map<string, string>) {
  for (const { row, code } of preparedRowsWithCodes()) {
    if (excludedLoadProductCodes.has(code)) continue;

    const shape = inferProductShape(row);
    const catalog = await prisma.productCatalog.create({
      data: {
        code,
        family: shape.family,
        description: row.description,
        weightKg: parseSheetNumber(row.actualWeightKg),
        lengthMm: shape.lengthMm,
        widthMm: shape.widthMm,
        heightMm: shape.heightMm,
        stackable: shape.stackable,
        rotationAllowed: shape.rotationAllowed,
      },
    });

    await prisma.operationProductAssignment.create({
      data: {
        operationId,
        productCatalogId: catalog.id,
        operationDestinationId: destinationAssignmentsByCode.get(row.destinationCode),
        quantity: 1,
        weightKgOverride: parseSheetNumber(row.actualWeightKg),
        lengthMmOverride: shape.lengthMm,
        widthMmOverride: shape.widthMm,
        heightMmOverride: shape.heightMm,
        stackableOverride: shape.stackable,
        rotationAllowedOverride: shape.rotationAllowed,
        notes: buildProductDescription(row),
      },
    });
  }
}

function preparedRowsWithCodes() {
  return rows
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

function buildProductDescription(row: SheetRow) {
  return row.description;
}

function parseSheetNumber(value: string) {
  return Number(value.replace(/,/g, ''));
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

function uniqueBy<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
