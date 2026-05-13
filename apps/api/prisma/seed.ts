import 'dotenv/config';
import { LoadingMethod, OperationStatus, PlanStatus, ProductFamily, TruckZoneType } from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
import { LoadingPlansService } from '../src/loading-plans/loading-plans.service';
import { PrismaService } from '../src/prisma/prisma.service';

const DEMO_OPERATION_CODE = 'OP-DEMO-ACERERA-001';
const COMPLETE_TRUCK_DEMO_OPERATION_CODE = 'OP-DEMO-CAMION-COMPLETO-001';
const VOLUMETRIC_DEMO_OPERATION_CODE = 'OP-DEMO-VOLUMETRICO-001';

type VolumetricPlacedInput = {
  productId: string;
  unitIndex: number;
  truckZoneId: string;
  xMm: number;
  yMm: number;
  zMm: number;
  rotationDeg: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  locked: boolean;
  manuallyAdjusted: boolean;
  zoneType: TruckZoneType;
};

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    await deleteExistingDemo(prisma, DEMO_OPERATION_CODE);
    await deleteExistingDemo(prisma, COMPLETE_TRUCK_DEMO_OPERATION_CODE);
    await deleteExistingDemo(prisma, VOLUMETRIC_DEMO_OPERATION_CODE);

    const operation = await prisma.loadOperation.create({
      data: {
        code: DEMO_OPERATION_CODE,
        name: 'Demo Acerera - reparto perfiles, tubos y chapas',
        notes: 'Operacion demo idempotente para revisar el MVP desde frontend.',
        scheduledAt: new Date('2026-05-18T08:30:00.000Z'),
      },
    });

    const truck = await prisma.truck.create({
      data: {
        operationId: operation.id,
        plate: 'DEMO-782',
        description: 'Semirremolque playo 13.6m con tres zonas operativas de descarga.',
        loadingMethod: LoadingMethod.REAR,
        maxPayloadKg: 28000,
        lengthMm: 13600,
        widthMm: 2480,
        heightMm: 2700,
      },
    });

    await prisma.truckZone.createMany({
      data: [
        {
          truckId: truck.id,
          type: TruckZoneType.CABIN_SIDE,
          name: 'Tercio delantero / cabina',
          maxWeightKg: 10000,
          startXMm: 0,
          endXMm: 4533,
          startYMm: 0,
          endYMm: 2480,
        },
        {
          truckId: truck.id,
          type: TruckZoneType.CENTER,
          name: 'Tercio central',
          maxWeightKg: 10000,
          startXMm: 4533,
          endXMm: 9066,
          startYMm: 0,
          endYMm: 2480,
        },
        {
          truckId: truck.id,
          type: TruckZoneType.DOOR_SIDE,
          name: 'Tercio trasero / puerta',
          maxWeightKg: 8000,
          startXMm: 9066,
          endXMm: 13600,
          startYMm: 0,
          endYMm: 2480,
        },
      ],
    });

    const destinations = await Promise.all([
      prisma.destination.create({
        data: {
          operationId: operation.id,
          code: 'ROS-SUR',
          name: 'Rosario Sur - nave montaje',
          unloadingOrder: 1,
          address: 'Av. Circunvalacion y Ovidio Lagos, Rosario',
          notes: 'Primera descarga: requiere acceso rapido desde puerta trasera.',
        },
      }),
      prisma.destination.create({
        data: {
          operationId: operation.id,
          code: 'VGG-IND',
          name: 'Villa Gobernador Galvez - planta industrial',
          unloadingOrder: 2,
          address: 'Parque Industrial VGG, Santa Fe',
          notes: 'Descarga intermedia con puente grua.',
        },
      }),
      prisma.destination.create({
        data: {
          operationId: operation.id,
          code: 'SN-OBRA',
          name: 'San Nicolas - obra laminacion',
          unloadingOrder: 3,
          address: 'Ruta 188 km 6, San Nicolas',
          notes: 'Ultima descarga, paquetes pesados cerca de cabina.',
        },
      }),
    ]);

    const [rosarioSur, villaGalvez, sanNicolas] = destinations;

    await prisma.loadProduct.createMany({
      data: [
        product(operation.id, rosarioSur.id, 'PER-IPN-200-4M', ProductFamily.PROFILE, 'Perfil IPN 200 x 4m', 1, 500, 4000, 220, 220, true, true),
        product(operation.id, rosarioSur.id, 'TUB-RECT-12080-4M', ProductFamily.TUBE, 'Tubo rectangular 120x80 x 4m', 1, 350, 4000, 180, 160, true, true),
        product(operation.id, rosarioSur.id, 'BAR-RED-32-4M', ProductFamily.BAR, 'Barras redondas 32mm paquete', 1, 280, 4000, 260, 180, true, true),
        product(operation.id, rosarioSur.id, 'PKG-ANCL-ROS', ProductFamily.GENERIC_PACKAGE, 'Cajon anclajes y buloneria Rosario', 1, 620, 1200, 1000, 850, false, true),
        product(operation.id, villaGalvez.id, 'SHT-8MM-3000X1200', ProductFamily.SHEET, 'Chapas 8mm 3000x1200 palletizadas', 1, 740, 3000, 1200, 260, true, false),
        product(operation.id, villaGalvez.id, 'PER-UPN-160-4M', ProductFamily.PROFILE, 'Perfil UPN 160 x 4m', 1, 410, 4000, 200, 180, true, true),
        product(operation.id, villaGalvez.id, 'TUB-CUAD-100-4M', ProductFamily.TUBE, 'Tubo cuadrado 100x100 x 4m', 1, 380, 4000, 180, 180, true, true),
        product(operation.id, villaGalvez.id, 'PKG-ELECT-VGG', ProductFamily.GENERIC_PACKAGE, 'Pallet accesorios y bandejas Villa Galvez', 1, 620, 1400, 850, 900, false, true),
        product(operation.id, sanNicolas.id, 'PER-HEB-240-4M', ProductFamily.PROFILE, 'Perfil HEB 240 x 4m', 1, 790, 4000, 260, 260, true, true),
        product(operation.id, sanNicolas.id, 'BAR-PLANA-10010-4M', ProductFamily.BAR, 'Barras planas 100x10 x 4m', 1, 460, 4000, 260, 160, true, true),
        product(operation.id, sanNicolas.id, 'SHT-12MM-2500X1000', ProductFamily.SHEET, 'Chapas 12mm 2500x1000 palletizadas', 1, 700, 2500, 1000, 300, true, false),
        product(operation.id, sanNicolas.id, 'PKG-CONS-SN', ProductFamily.GENERIC_PACKAGE, 'Pallet consumibles San Nicolas', 1, 560, 1200, 700, 900, false, true),
      ],
    });

    const auditService = new AuditService(prisma);
    const loadingPlansService = new LoadingPlansService(prisma, auditService);
    const plan = await loadingPlansService.generate(operation.id);
    const completeTruckDemo = await createCompleteTruckDemo(prisma, loadingPlansService);
    const volumetricDemo = await createVolumetricDemo(prisma);

    console.log(JSON.stringify({
      demos: [
        summary(operation.id, operation.code, plan),
        completeTruckDemo,
        volumetricDemo,
      ],
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function deleteExistingDemo(prisma: PrismaService, code: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.loadOperation.findUnique({
      where: { code },
      select: { id: true },
    });

    if (!existing) return;

    await tx.loadingPlan.deleteMany({ where: { operationId: existing.id } });
    await tx.loadOperation.delete({ where: { id: existing.id } });
  });
}

async function createCompleteTruckDemo(prisma: PrismaService, loadingPlansService: LoadingPlansService) {
  const operation = await prisma.loadOperation.create({
    data: {
      code: COMPLETE_TRUCK_DEMO_OPERATION_CODE,
      name: 'Demo camion completo - planta acerera',
      notes: 'Operacion demo idempotente con paquetes rectangulares para visualizar un camion casi completo en 2D/3D.',
      scheduledAt: new Date('2026-05-19T07:00:00.000Z'),
    },
  });

  const truck = await prisma.truck.create({
    data: {
      operationId: operation.id,
      plate: 'FULL-136',
      description: 'Semirremolque siderurgico 13.6m armado para demo visual de ocupacion completa.',
      loadingMethod: LoadingMethod.REAR,
      maxPayloadKg: 28000,
      lengthMm: 13600,
      widthMm: 2480,
      heightMm: 2700,
    },
  });

  await prisma.truckZone.createMany({
    data: [
      {
        truckId: truck.id,
        type: TruckZoneType.CABIN_SIDE,
        name: 'Zona cabina - paquetes finales',
        maxWeightKg: 9000,
        startXMm: 0,
        endXMm: 4533,
        startYMm: 0,
        endYMm: 2480,
      },
      {
        truckId: truck.id,
        type: TruckZoneType.CENTER,
        name: 'Zona central - paquetes intermedios',
        maxWeightKg: 9000,
        startXMm: 4533,
        endXMm: 9066,
        startYMm: 0,
        endYMm: 2480,
      },
      {
        truckId: truck.id,
        type: TruckZoneType.DOOR_SIDE,
        name: 'Zona puerta - primera descarga',
        maxWeightKg: 9000,
        startXMm: 9066,
        endXMm: 13600,
        startYMm: 0,
        endYMm: 2480,
      },
    ],
  });

  const destinations = await Promise.all([
    prisma.destination.create({
      data: {
        operationId: operation.id,
        code: 'DESC-01-PUERTA',
        name: 'Primera descarga - nave corte',
        unloadingOrder: 1,
        address: 'Planta acerera - muelle 1',
        notes: 'Debe quedar del lado puerta para descarga inicial.',
      },
    }),
    prisma.destination.create({
      data: {
        operationId: operation.id,
        code: 'DESC-02-CENTRO',
        name: 'Segunda descarga - deposito central',
        unloadingOrder: 2,
        address: 'Planta acerera - deposito de perfiles',
        notes: 'Carga intermedia ubicada en el tercio central.',
      },
    }),
    prisma.destination.create({
      data: {
        operationId: operation.id,
        code: 'DESC-03-CABINA',
        name: 'Ultima descarga - laminacion',
        unloadingOrder: 3,
        address: 'Planta acerera - nave laminacion',
        notes: 'Carga final ubicada hacia cabina.',
      },
    }),
  ]);

  const [doorSide, center, cabinSide] = destinations;

  await prisma.loadProduct.createMany({
    data: [
      product(operation.id, doorSide.id, 'FULL-PUERTA-2266X1240', ProductFamily.GENERIC_PACKAGE, 'Paquete siderurgico rectangular primera descarga', 4, 1800, 2266, 1240, 450, false, false),
      product(operation.id, center.id, 'FULL-CENTRO-2266X1240', ProductFamily.GENERIC_PACKAGE, 'Paquete siderurgico rectangular descarga intermedia', 4, 1800, 2266, 1240, 450, false, false),
      product(operation.id, cabinSide.id, 'FULL-CABINA-2266X1240', ProductFamily.GENERIC_PACKAGE, 'Paquete siderurgico rectangular ultima descarga', 4, 1800, 2266, 1240, 450, false, false),
    ],
  });

  const plan = await loadingPlansService.generate(operation.id);
  return summary(operation.id, operation.code, plan);
}

async function createVolumetricDemo(prisma: PrismaService) {
  const operation = await prisma.loadOperation.create({
    data: {
      code: VOLUMETRIC_DEMO_OPERATION_CODE,
      name: 'Demo volumetrico - camion completo en altura',
      notes: 'Demo visual con apilado manual 3D. No representa optimizacion automatica de planner v1.',
      scheduledAt: new Date('2026-05-20T06:30:00.000Z'),
    },
  });

  const truck = await prisma.truck.create({
    data: {
      operationId: operation.id,
      plate: 'VOL-270',
      description: 'Semirremolque 13.6m para demo visual de ocupacion X/Y/Z con tres niveles manuales.',
      loadingMethod: LoadingMethod.REAR,
      maxPayloadKg: 28000,
      lengthMm: 13600,
      widthMm: 2480,
      heightMm: 2700,
    },
  });

  const zones = await Promise.all([
    prisma.truckZone.create({
      data: {
        truckId: truck.id,
        type: TruckZoneType.CABIN_SIDE,
        name: 'Cabina - ultima descarga apilada',
        maxWeightKg: 9000,
        startXMm: 0,
        endXMm: 4533,
        startYMm: 0,
        endYMm: 2480,
      },
    }),
    prisma.truckZone.create({
      data: {
        truckId: truck.id,
        type: TruckZoneType.CENTER,
        name: 'Centro - descarga intermedia apilada',
        maxWeightKg: 9000,
        startXMm: 4533,
        endXMm: 9066,
        startYMm: 0,
        endYMm: 2480,
      },
    }),
    prisma.truckZone.create({
      data: {
        truckId: truck.id,
        type: TruckZoneType.DOOR_SIDE,
        name: 'Puerta - primera descarga apilada',
        maxWeightKg: 9000,
        startXMm: 9066,
        endXMm: 13600,
        startYMm: 0,
        endYMm: 2480,
      },
    }),
  ]);

  const [cabinZone, centerZone, doorZone] = zones;
  const destinations = await Promise.all([
    prisma.destination.create({
      data: {
        operationId: operation.id,
        code: 'VOL-01-PUERTA',
        name: 'Rosario - primera descarga volumetrica',
        unloadingOrder: 1,
        address: 'Parque industrial Rosario, muelle 3',
        notes: 'Queda cerca de puerta para descarga inicial.',
      },
    }),
    prisma.destination.create({
      data: {
        operationId: operation.id,
        code: 'VOL-02-CENTRO',
        name: 'San Lorenzo - segunda descarga volumetrica',
        unloadingOrder: 2,
        address: 'Deposito metalurgico San Lorenzo',
        notes: 'Bloque central con tres niveles visibles.',
      },
    }),
    prisma.destination.create({
      data: {
        operationId: operation.id,
        code: 'VOL-03-CABINA',
        name: 'Villa Constitucion - descarga final volumetrica',
        unloadingOrder: 3,
        address: 'Nave terminacion Villa Constitucion',
        notes: 'Carga final contra cabina.',
      },
    }),
  ]);

  const [doorSide, center, cabinSide] = destinations;
  const products = await Promise.all([
    prisma.loadProduct.create({ data: product(operation.id, cabinSide.id, 'VOL-CAB-2266X1240X850', ProductFamily.GENERIC_PACKAGE, 'Cajon metalurgico apilable descarga final', 12, 600, 2266, 1240, 850, true, false) }),
    prisma.loadProduct.create({ data: product(operation.id, center.id, 'VOL-CEN-2266X1240X850', ProductFamily.GENERIC_PACKAGE, 'Cajon metalurgico apilable descarga intermedia', 12, 600, 2266, 1240, 850, true, false) }),
    prisma.loadProduct.create({ data: product(operation.id, doorSide.id, 'VOL-PUE-2266X1240X850', ProductFamily.GENERIC_PACKAGE, 'Cajon metalurgico apilable primera descarga', 12, 600, 2266, 1240, 850, true, false) }),
  ]);

  const [cabinProduct, centerProduct, doorProduct] = products;
  const placedInputs: VolumetricPlacedInput[] = [];
  const unitIndexes = new Map<string, number>();

  for (const zMm of [0, 850, 1700]) {
    for (const yMm of [0, 1240]) {
      for (const xMm of [0, 2266, 4532, 6798, 9064, 11330]) {
        const zone = xMm < 4533 ? cabinZone : xMm < 9066 ? centerZone : doorZone;
        const productForZone = zone.type === TruckZoneType.CABIN_SIDE ? cabinProduct : zone.type === TruckZoneType.CENTER ? centerProduct : doorProduct;
        const nextUnitIndex = (unitIndexes.get(productForZone.id) ?? 0) + 1;
        unitIndexes.set(productForZone.id, nextUnitIndex);

        placedInputs.push({
          productId: productForZone.id,
          unitIndex: nextUnitIndex,
          truckZoneId: zone.id,
          xMm,
          yMm,
          zMm,
          rotationDeg: 0,
          lengthMm: 2266,
          widthMm: 1240,
          heightMm: 850,
          locked: true,
          manuallyAdjusted: true,
          zoneType: zone.type,
        });
      }
    }
  }

  const plan = await prisma.$transaction(async (tx) => {
    await tx.loadingPlan.updateMany({ where: { operationId: operation.id, isCurrent: true }, data: { isCurrent: false } });

    const createdPlan = await tx.loadingPlan.create({
      data: {
        operationId: operation.id,
        version: 1,
        status: PlanStatus.MODIFIED,
        method: LoadingMethod.REAR,
        isCurrent: true,
        notes: 'Plan creado manualmente para demo visual volumetrica con 3 niveles. Planner v1 no genera apilado Z.',
      },
    });

    const placedItems: Array<VolumetricPlacedInput & { id: string }> = [];
    for (const input of placedInputs) {
      const placedItem = await tx.placedItem.create({
        data: {
          planId: createdPlan.id,
          productId: input.productId,
          unitIndex: input.unitIndex,
          truckZoneId: input.truckZoneId,
          xMm: input.xMm,
          yMm: input.yMm,
          zMm: input.zMm,
          rotationDeg: input.rotationDeg,
          lengthMm: input.lengthMm,
          widthMm: input.widthMm,
          heightMm: input.heightMm,
          locked: input.locked,
          manuallyAdjusted: input.manuallyAdjusted,
        },
      });
      placedItems.push({ ...input, id: placedItem.id });
    }

    const loadOrder = [...placedItems].sort((a, b) => a.xMm - b.xMm || a.zMm - b.zMm || a.yMm - b.yMm);
    await tx.loadingStep.createMany({
      data: loadOrder.map((item, index) => ({
        planId: createdPlan.id,
        placedItemId: item.id,
        sequence: index + 1,
        title: `Ubicar bulto volumetrico ${index + 1}`,
        instructions: `Carga manual demo: posicion X ${item.xMm}mm, Y ${item.yMm}mm, nivel Z ${item.zMm}mm. Mantener bloque ${item.zoneType.toLowerCase()} alineado para visualizar tres capas.`,
      })),
    });

    await tx.planMetrics.create({
      data: volumetricMetrics(createdPlan.id, placedItems),
    });

    await tx.loadOperation.update({
      where: { id: operation.id },
      data: { status: OperationStatus.PLAN_GENERATED },
    });

    return createdPlan;
  });

  const metrics = volumetricMetrics(plan.id, placedInputs);
  return {
    operationId: operation.id,
    operationCode: operation.code,
    frontendPath: `/operations/${operation.id}/planner`,
    frontendUrl: `http://localhost:5173/operations/${operation.id}/planner`,
    planId: plan.id,
    planVersion: plan.version,
    placedItemCount: metrics.placedItemCount,
    unplacedItemCount: metrics.unplacedItemCount,
    criticalAlerts: metrics.criticalAlertCount,
    warningAlerts: metrics.warningAlertCount,
  };
}

function summary(operationId: string, operationCode: string, plan: Awaited<ReturnType<LoadingPlansService['generate']>>) {
  return {
    operationId,
    operationCode,
    frontendPath: `/operations/${operationId}/planner`,
    frontendUrl: `http://localhost:5173/operations/${operationId}/planner`,
    planId: plan.id,
    planVersion: plan.version,
    placedItemCount: plan.metrics?.placedItemCount ?? 0,
    unplacedItemCount: plan.metrics?.unplacedItemCount ?? 0,
    criticalAlerts: plan.alertCounts.critical,
    warningAlerts: plan.alertCounts.warning,
  };
}

function volumetricMetrics(planId: string, placedItems: Array<Pick<VolumetricPlacedInput, 'xMm' | 'yMm' | 'zMm' | 'lengthMm' | 'widthMm' | 'heightMm' | 'zoneType'>>) {
  const itemWeightKg = 600;
  const placedWeightKg = placedItems.length * itemWeightKg;
  const usedVolumeM3 = placedItems.reduce((sum, item) => sum + (item.lengthMm * item.widthMm * item.heightMm) / 1_000_000_000, 0);
  const truckVolumeM3 = (13600 * 2480 * 2700) / 1_000_000_000;
  const zoneWeight = (zoneType: TruckZoneType) => placedItems.filter((item) => item.zoneType === zoneType).length * itemWeightKg;

  return {
    planId,
    totalWeightKg: placedWeightKg,
    placedWeightKg,
    unplacedWeightKg: 0,
    usedVolumeM3,
    volumeUtilizationPct: (usedVolumeM3 / truckVolumeM3) * 100,
    placedItemCount: placedItems.length,
    unplacedItemCount: 0,
    leftWeightKg: placedWeightKg / 2,
    rightWeightKg: placedWeightKg / 2,
    cabinSideWeightKg: zoneWeight(TruckZoneType.CABIN_SIDE),
    centerWeightKg: zoneWeight(TruckZoneType.CENTER),
    doorSideWeightKg: zoneWeight(TruckZoneType.DOOR_SIDE),
    criticalAlertCount: 0,
    warningAlertCount: 0,
    loadLengthMm: placedItems.reduce((max, item) => Math.max(max, item.xMm + item.lengthMm), 0),
    maxHeightMm: placedItems.reduce((max, item) => Math.max(max, item.zMm + item.heightMm), 0),
    centerOfGravityX: 6798,
    centerOfGravityY: 1240,
    centerOfGravityZ: 1275,
  };
}

function product(
  operationId: string,
  destinationId: string,
  code: string,
  family: ProductFamily,
  description: string,
  quantity: number,
  weightKg: number,
  lengthMm: number,
  widthMm: number,
  heightMm: number,
  stackable: boolean,
  rotationAllowed: boolean,
) {
  return {
    operationId,
    destinationId,
    code,
    family,
    description,
    quantity,
    weightKg,
    lengthMm,
    widthMm,
    heightMm,
    stackable,
    rotationAllowed,
  };
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
