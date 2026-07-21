import 'dotenv/config';
import { LoadingMethod, ProductFamily, TruckZoneType } from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
import { LoadingPlansService } from '../src/loading-plans/loading-plans.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Full-truck demo seed — purely ADDITIVE and re-runnable.
 *
 * This is the seed behind the 3D planner demo video. It inserts ONE standalone
 * LoadOperation (`OP-FULL-DEMO`) representing a FULL, REALISTIC, BALANCED truck
 * load for an ACERIA / metal distributor: 3 destinations spread across the 3
 * truck zones (DOOR_SIDE / CENTER / CABIN_SIDE via unloadingOrder 1/2/3), the 9
 * steel product families (COIL, SHEET, PROFILE, TUBE, BAR, REBAR, SQUARE_TUBE,
 * ANGLE, MESH) with multi-tier stacking, then generates + approves the plan so
 * the 3D planner view has a realistic "whole truck" scenario to render.
 *
 * Safe to run on an existing DB: it only deletes/recreates rows scoped strictly
 * to its own `OP-FULL-DEMO` code (so re-running just refreshes the demo), and
 * never touches the canonical seed.ts rows nor the OP-STACK-DEMO demo.
 *
 * Prereqs: Postgres running (docker compose up -d postgres) and migrations
 * applied (npm run prisma:migrate). Then, from apps/api:
 *
 *   export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:55433/camiones?schema=public"
 *   npm run seed:full-demo
 *
 * It prints the operation id and the ready-to-open planner/report URLs.
 * Expected result: 54 placed items, 0 unplaced, 0 critical, 0 balance warnings.
 */

const WEB_BASE_URL = 'http://localhost:5173';
const SEED_ACTOR = 'seed:full-demo';

const CODES = {
  operation: 'OP-FULL-DEMO',
  truckPlate: 'TRACTOR-FULL-DEMO',
  destinations: ['DST-FULL-DEMO-1', 'DST-FULL-DEMO-2', 'DST-FULL-DEMO-3'],
};

/**
 * Physical spec per STEEL product family (metal-distributor / acería load).
 * COIL is heavy + non-stackable (round stock, sits on the floor, doesn't
 * stack); every other family is stackable and provides the bulk + multi-tier
 * fill. All lengths are kept <= ~4400mm — each truck ZONE is only ~4534mm
 * long, so anything longer would overflow its zone and become UNPLACED.
 */
const SPEC = {
  coil: { family: ProductFamily.COIL, label: 'Rollo de alambre', weightKg: 1400, lengthMm: 1100, widthMm: 1100, heightMm: 1100, stackable: false, rotationAllowed: true },
  sheet: { family: ProductFamily.SHEET, label: 'Chapa de acero', weightKg: 480, lengthMm: 3000, widthMm: 1200, heightMm: 250, stackable: true, rotationAllowed: false },
  profile: { family: ProductFamily.PROFILE, label: 'Perfil IPN', weightKg: 125, lengthMm: 4000, widthMm: 220, heightMm: 220, stackable: true, rotationAllowed: true },
  tube: { family: ProductFamily.TUBE, label: 'Caño redondo', weightKg: 95, lengthMm: 4000, widthMm: 180, heightMm: 160, stackable: true, rotationAllowed: true },
  bar: { family: ProductFamily.BAR, label: 'Planchuela', weightKg: 55, lengthMm: 4000, widthMm: 130, heightMm: 45, stackable: true, rotationAllowed: true },
  rebar: { family: ProductFamily.REBAR, label: 'Hierro de construcción', weightKg: 650, lengthMm: 4200, widthMm: 260, heightMm: 260, stackable: true, rotationAllowed: true },
  squareTube: { family: ProductFamily.SQUARE_TUBE, label: 'Caño cuadrado', weightKg: 110, lengthMm: 4000, widthMm: 170, heightMm: 170, stackable: true, rotationAllowed: true },
  angle: { family: ProductFamily.ANGLE, label: 'Ángulo / perfil L', weightKg: 90, lengthMm: 4000, widthMm: 150, heightMm: 150, stackable: true, rotationAllowed: true },
  mesh: { family: ProductFamily.MESH, label: 'Malla SIMA', weightKg: 120, lengthMm: 3000, widthMm: 1500, heightMm: 90, stackable: true, rotationAllowed: false },
} as const;

/**
 * Per-destination quantities — deliberately ASYMMETRIC across the 3
 * destinations (rather than the same 9-family mix repeated 3x), for
 * empirically-discovered reasons. Tuned so REBAR/SQUARE_TUBE/PROFILE (once
 * capped to 1 unit each to dodge a fragmentation cascade) now appear in
 * clearly VISIBLE quantities (REBAR 5, SQUARE_TUBE 4, PROFILE 3) alongside
 * every other family, with 0 unplaced items and 0 balance warnings.
 *
 * 1. CENTER is the dedicated BAR-STOCK zone: PROFILE, REBAR, SQUARE_TUBE,
 *    TUBE, ANGLE, BAR are its "own" destination items — all long
 *    (~4000-4200mm, close to the ~4534mm zone length) and narrow
 *    (130-260mm wide), so they lane-and-stack together without ever
 *    competing with COIL/SHEET's much wider floor footprint. REBAR (5) and
 *    PROFILE (3) are heaviest, so they're processed first and always claim
 *    their own floor lanes (5*260 + 3*220 = 1990mm of CENTER's 2480mm zone
 *    width) — that's why bumping them past 1 unit no longer starves anyone:
 *    with COIL/SHEET absent from CENTER, there's no wide competing
 *    footprint, so SQUARE_TUBE/TUBE/ANGLE/BAR simply lane into whatever
 *    width remains and stack multi-tier (observed up to tier 14) once it
 *    runs out — this is the packer's floor-first behavior: it always grabs
 *    a NEW parallel floor lane over stacking while width remains (surfaces
 *    tried Z-ascending, returns on the first feasible (x,y)), only spilling
 *    a family into stacked tiers once its footprint genuinely has no more
 *    floor room. Processing order is weight-descending: REBAR (650kg) >
 *    PROFILE (125kg) > SQUARE_TUBE (110kg) > TUBE (95kg) > ANGLE (90kg) >
 *    BAR (55kg).
 *
 *    A handful of CENTER's own SQUARE_TUBE/TUBE/ANGLE/BAR units still
 *    overflow into DOOR_SIDE (empirically observed, harmless: all 9
 *    families + 0 unplaced are unaffected) — DOOR_SIDE's own mix
 *    deliberately ALSO lists a small SQUARE_TUBE/TUBE/ANGLE/BAR filler
 *    (`{ squareTube: 2, tube: 2, angle: 1, bar: 1 }`) so that overflow has
 *    somewhere predictable to land instead of colliding unpredictably with
 *    DOOR_SIDE's own COIL/SHEET pair. COIL/SHEET are still the heaviest
 *    items *within DOOR_SIDE's own destination block*, so they're placed
 *    first and claim the y=0 / first-lane slots regardless of this filler.
 *
 * 2. MESH is listed under CABIN_SIDE's own destination (not CENTER's):
 *    CABIN_SIDE's own COIL+SHEET already use ~2300mm of its 2480mm zone
 *    width, leaving no room for MESH's 1500mm-wide footprint there, so MESH
 *    always fails to place in CABIN_SIDE and falls back to the first zone
 *    with room. Since CABIN_SIDE (unloadingOrder 3) is processed *before*
 *    CENTER's own destination block (see the sort in `expandAndSortUnits`:
 *    destinationOrder descending, so order 3 → 2 → 1), MESH's fallback
 *    reliably lands in CENTER while CENTER is still completely empty --
 *    deterministic, and it doesn't compete with CENTER's own REBAR/PROFILE
 *    for floor width since it's placed before them.
 *
 * 3. The packer's within-zone placement is a plain first-fit skyline scan
 *    with NO left/right balancing (that soft rule only picks *between
 *    zones*, see heuristic-loading-planner.ts chooseZoneCandidate) — so in
 *    every zone the heaviest family (COIL, ~1100mm wide) is placed FIRST
 *    into an empty zone and always lands at y=0, i.e. structurally on the
 *    truck's left half. Left uncorrected this makes the whole truck
 *    left-heavy. The fix: pair every COIL with a SHEET stack sized so its
 *    weight roughly matches the COIL's — SHEET (1200mm wide) always lands
 *    in the *next* Y-band right after COIL's, i.e. on the right half, and
 *    stacking multiple SHEET units on the exact same footprint (multi-tier)
 *    adds weight without consuming extra width.
 *
 *    Empirically, the CENTER/DOOR_SIDE bar-stock split above (needed to
 *    reach visible REBAR/SQUARE_TUBE/PROFILE quantities) perturbs this
 *    COIL/SHEET left-right cancellation enough to need a small counterweight:
 *    REBAR's 5th unit (vs. the 4-unit minimum target) was the empirically
 *    smallest tweak found that brings the truck-wide left/right split under
 *    the 20% warning threshold (final: ~19.2%) without re-introducing
 *    unplaced items. Don't reduce REBAR back to 4 without re-checking the
 *    left/right split — it's the balancing knob for this whole layout.
 */
const DESTINATION_MIX: Partial<Record<keyof typeof SPEC, number>>[] = [
  // index 0 -> unloadingOrder 1 -> DOOR_SIDE (processed LAST as a whole destination-block, but
  // COIL/SHEET are still the heaviest units *within this block* so they claim the y=0/first-lane
  // slots before the lighter bar-stock filler below, keeping the COIL-left/SHEET-right pairing intact).
  { coil: 3, sheet: 9, squareTube: 2, tube: 2, angle: 1, bar: 1 },
  // index 1 -> unloadingOrder 2 -> CENTER (processed 2nd): dedicated bar-stock zone. REBAR=5 (not the
  // 4-unit minimum) is the empirically-found left/right balance counterweight -- see note (3) above.
  { rebar: 5, profile: 3, squareTube: 2, tube: 4, angle: 2, bar: 2 },
  // index 2 -> unloadingOrder 3 -> CABIN_SIDE (processed FIRST): coil (left) + stacked sheet (right).
  // MESH deliberately falls back into CENTER -- see note (2) above.
  { coil: 3, sheet: 9, mesh: 6 },
];

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    // Re-runnable: scope delete strictly to this script's own operation code.
    // PlacedItem/UnplacedItem -> LoadProduct is onDelete: Restrict, so plan
    // rows (and their cascade children) must be deleted BEFORE the
    // LoadProduct rows / the LoadOperation row itself, or Postgres rejects
    // the cascade with a foreign-key violation.
    const existing = await prisma.loadOperation.findUnique({ where: { code: CODES.operation }, select: { id: true } });
    if (existing) {
      await prisma.loadingPlan.deleteMany({ where: { operationId: existing.id } });
      await prisma.loadOperation.delete({ where: { id: existing.id } });
    }

    const auditService = new AuditService(prisma);
    const loadingPlansService = new LoadingPlansService(prisma, auditService);

    const operation = await prisma.loadOperation.create({
      data: {
        code: CODES.operation,
        name: 'Camion completo demo',
        notes: 'Operacion demo standalone (additiva) para mostrar un camion completo de distribuidor de metales / aceria, realista y balanceado en el plan 3D: 3 destinos, 3 zonas, 9 familias de producto (rollos, chapas, hierros/perfiles IPN, tubos redondos, planchuelas, hierro de construccion, canos cuadrados, angulos y malla SIMA) y varios niveles de apilado.',
      },
    });

    const destinations = await Promise.all(
      [1, 2, 3].map((unloadingOrder, index) =>
        prisma.destination.create({
          data: {
            operationId: operation.id,
            code: CODES.destinations[index],
            name: `Destino ${unloadingOrder} - camion completo demo`,
            unloadingOrder,
            address: `Deposito demo camion completo ${unloadingOrder}`,
            notes: 'Destino demo para escena de camion completo en el planner 3D.',
          },
        }),
      ),
    );

    const truck = await prisma.truck.create({
      data: {
        operationId: operation.id,
        plate: CODES.truckPlate,
        description: 'Tractor demo camion completo con semirremolque playo de 13.6m.',
        loadingMethod: LoadingMethod.REAR,
        maxPayloadKg: 28000,
        lengthMm: 13600,
        widthMm: 2480,
        heightMm: 2700,
      },
    });

    await prisma.truckZone.createMany({
      data: defaultZones().map((zone) => ({
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

    for (const [index, destination] of destinations.entries()) {
      const suffix = `FULL-DEMO-${index + 1}`;
      const mix = DESTINATION_MIX[index] ?? {};

      const data = (Object.entries(mix) as [keyof typeof SPEC, number][])
        .filter(([, qty]) => qty > 0)
        .map(([key, qty]) => {
          const spec = SPEC[key];
          return {
            operationId: operation.id,
            destinationId: destination.id,
            code: `SKU-${key.toUpperCase()}-${suffix}`,
            family: spec.family,
            description: `${spec.label} - destino ${index + 1} (camion completo demo)`,
            quantity: qty,
            weightKg: spec.weightKg,
            lengthMm: spec.lengthMm,
            widthMm: spec.widthMm,
            heightMm: spec.heightMm,
            stackable: spec.stackable,
            rotationAllowed: spec.rotationAllowed,
          };
        });

      await prisma.loadProduct.createMany({ data });
    }

    const currentPlan = await loadingPlansService.generate(operation.id);
    const approvedPlan = await loadingPlansService.approve(currentPlan.id, SEED_ACTOR);

    console.log(JSON.stringify({
      message: 'Additive full-demo LoadOperation created (canonical demo data untouched)',
      operation: { id: operation.id, code: operation.code },
      frontendPaths: {
        operation: `${WEB_BASE_URL}/operations/${operation.id}`,
        planner: `${WEB_BASE_URL}/operations/${operation.id}/planner`,
        report: `${WEB_BASE_URL}/operations/${operation.id}/report`,
      },
      plan: {
        id: approvedPlan.id,
        status: approvedPlan.planStatus,
        placedItems: approvedPlan.metrics?.placedItemCount ?? 0,
        unplacedItems: approvedPlan.metrics?.unplacedItemCount ?? 0,
        totalWeightKg: approvedPlan.metrics?.totalWeightKg ?? 0,
        leftWeightKg: approvedPlan.metrics?.leftWeightKg ?? 0,
        rightWeightKg: approvedPlan.metrics?.rightWeightKg ?? 0,
        cabinSideWeightKg: approvedPlan.metrics?.cabinSideWeightKg ?? 0,
        centerWeightKg: approvedPlan.metrics?.centerWeightKg ?? 0,
        doorSideWeightKg: approvedPlan.metrics?.doorSideWeightKg ?? 0,
        criticalAlerts: approvedPlan.metrics?.criticalAlertCount ?? 0,
        warningAlerts: approvedPlan.metrics?.warningAlertCount ?? 0,
      },
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

function defaultZones() {
  return [
    { type: TruckZoneType.CABIN_SIDE, name: 'Tercio delantero / cabina', maxWeightKg: 9500, startXMm: 0, endXMm: 4533, startYMm: 0, endYMm: 2480 },
    { type: TruckZoneType.CENTER, name: 'Tercio central', maxWeightKg: 9500, startXMm: 4533, endXMm: 9066, startYMm: 0, endYMm: 2480 },
    { type: TruckZoneType.DOOR_SIDE, name: 'Tercio trasero / puerta', maxWeightKg: 9000, startXMm: 9066, endXMm: 13600, startYMm: 0, endYMm: 2480 },
  ];
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
