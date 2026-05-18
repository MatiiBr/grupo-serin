import 'dotenv/config';
import { LoadingMethod, PrismaClient, ProductFamily, TruckZoneType } from '@prisma/client';

const WEB_BASE_URL = 'http://localhost:5173';

const DEMO = {
  operationCode: 'OP-PLAN-SUGERIDO-001',
  truckPlate: 'DEMO-PLANNER-01',
};

async function main() {
  const prisma = new PrismaClient();

  try {
    await resetDatabase(prisma);
    const operation = await createPlannerDemo(prisma);

    console.log(JSON.stringify({
      message: 'Planner demo seed loaded',
      action: 'Abrir el planner y tocar "Generar plan" para ver score, candidato ganador y candidatos evaluados.',
      codes: {
        operation: operation.code,
        truck: DEMO.truckPlate,
      },
      frontendPaths: {
        operations: `${WEB_BASE_URL}/operations`,
        operation: `${WEB_BASE_URL}/operations/${operation.id}`,
        planner: `${WEB_BASE_URL}/operations/${operation.id}/planner`,
      },
      expectedPlannerSignal: {
        winner: 'light-first',
        why: 'El orden liviano-primero evita exceder el peso maximo de la zona de puerta.',
      },
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

async function createPlannerDemo(prisma: PrismaClient) {
  const operation = await prisma.loadOperation.create({
    data: {
      code: DEMO.operationCode,
      name: 'Demo plan sugerido: candidato light-first ganador',
      notes: 'Seed minimo para probar el planner: abrir planner y generar plan. El candidato liviano-primero deberia ganar por evitar una violacion hard en zona de puerta.',
      scheduledAt: new Date('2026-05-22T09:00:00.000Z'),
      truck: {
        create: {
          plate: DEMO.truckPlate,
          description: 'Camion demo corto con tres zonas de 1m para forzar comparacion de candidatos.',
          loadingMethod: LoadingMethod.REAR,
          maxPayloadKg: 2000,
          lengthMm: 3000,
          widthMm: 1000,
          heightMm: 1000,
          zones: {
            create: [
              { type: TruckZoneType.CABIN_SIDE, name: 'Cabina', maxWeightKg: 1200, startXMm: 0, endXMm: 1000, startYMm: 0, endYMm: 1000 },
              { type: TruckZoneType.CENTER, name: 'Centro', maxWeightKg: 1200, startXMm: 1000, endXMm: 2000, startYMm: 0, endYMm: 1000 },
              { type: TruckZoneType.DOOR_SIDE, name: 'Puerta - limite bajo', maxWeightKg: 400, startXMm: 2000, endXMm: 3000, startYMm: 0, endYMm: 1000 },
            ],
          },
        },
      },
    },
  });

  const destination = await prisma.destination.create({
    data: {
      operationId: operation.id,
      code: 'DST-DEMO-01',
      name: 'Cliente demo - primera descarga',
      unloadingOrder: 1,
      address: 'Dock demo 1',
      notes: 'Primera descarga: el planner intenta ubicar primero cerca de puerta.',
    },
  });

  await prisma.loadProduct.createMany({
    data: [
      {
        operationId: operation.id,
        destinationId: destination.id,
        code: 'PESO-500',
        family: ProductFamily.GENERIC_PACKAGE,
        description: 'Bulto pesado 500kg',
        quantity: 1,
        weightKg: 500,
        lengthMm: 1000,
        widthMm: 1000,
        heightMm: 300,
        stackable: false,
        rotationAllowed: true,
      },
      {
        operationId: operation.id,
        destinationId: destination.id,
        code: 'PESO-100',
        family: ProductFamily.GENERIC_PACKAGE,
        description: 'Bulto liviano 100kg',
        quantity: 1,
        weightKg: 100,
        lengthMm: 1000,
        widthMm: 1000,
        heightMm: 300,
        stackable: false,
        rotationAllowed: true,
      },
    ],
  });

  return prisma.loadOperation.findUniqueOrThrow({
    where: { id: operation.id },
    include: { truck: true, destinations: true, products: true },
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
