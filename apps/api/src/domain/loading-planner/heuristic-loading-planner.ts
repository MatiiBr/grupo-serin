import { AlertSeverity, AlertType, TruckZoneType, UnplacedReason } from '@prisma/client';
import { Bounds, Box, isWithinBounds, isWithinHeight, overlaps3D, Rect, supports, topZ } from './geometry';
import { buildTiers, tierHeightsExceedTruck } from './tiers';
import {
  LoadingPlannerInput,
  LoadingPlannerResult,
  PlannerPlacedItem,
  PlannerProductInput,
  PlannerTruckTierInput,
  PlannerTruckZoneInput,
} from './loading-planner.types';

interface Unit extends PlannerProductInput {
  unitIndex: number;
  destinationOrder: number;
  targetZone: TruckZoneType;
}

/**
 * Internal placed-item representation. Extends the public `PlannerPlacedItem`
 * persistence contract with the stacking attributes (`stackable`, `fragile`,
 * `maxStackLoadKg`) the solver needs to evaluate future placements against
 * this item as a potential supporter. These extra fields are never part of
 * `LoadingPlannerResult.placedItems`'s declared shape, but `Placed` is a
 * structural superset of `PlannerPlacedItem`, so it can always be returned
 * where a `PlannerPlacedItem[]` is expected.
 */
interface Placed extends PlannerPlacedItem {
  stackable: boolean;
  fragile: boolean;
  maxStackLoadKg?: number;
}

interface ZoneCandidate {
  id?: string;
  type: TruckZoneType;
  bounds: Bounds;
  maxWeightKg?: number;
}

interface Orientation {
  lengthMm: number;
  widthMm: number;
  rotationDeg: number;
}

/** A candidate resting surface: the truck floor, or the top of a placed item. */
interface Surface {
  zMm: number;
  tier: number;
  supporter?: Placed;
}

interface PlacementCandidate {
  zone: ZoneCandidate;
  orientation: Orientation;
  xMm: number;
  yMm: number;
  zMm: number;
  tier: number;
}

interface PlaceOutcome {
  item?: Placed;
  blockedByStacking: boolean;
}

const ZONE_ORDER = [TruckZoneType.CABIN_SIDE, TruckZoneType.CENTER, TruckZoneType.DOOR_SIDE];

export class HeuristicLoadingPlanner {
  generate(input: LoadingPlannerInput): LoadingPlannerResult {
    const truckLength = input.truck.lengthMm ?? 0;
    const truckWidth = input.truck.widthMm ?? 0;
    const truckHeight = input.truck.heightMm ?? 0;
    const zones = this.buildZones(input.truck.zones, truckLength, truckWidth);
    const tiers = buildTiers(input.truck.tiers, truckHeight);
    const units = this.expandAndSortUnits(input.products, input.destinations);
    const placedItems: Placed[] = [];
    const unplacedItems: LoadingPlannerResult['unplacedItems'] = [];

    for (const unit of units) {
      const outcome = this.placeUnit(unit, zones, tiers, placedItems, truckHeight, truckWidth);

      if (outcome.item) {
        placedItems.push({ ...outcome.item, sequence: placedItems.length + 1 });
        continue;
      }

      unplacedItems.push({
        productId: unit.id,
        unitIndex: unit.unitIndex,
        reason: this.unplacedReason(unit, outcome.blockedByStacking),
        message: this.unplacedMessage(unit, outcome.blockedByStacking),
      });
    }

    const steps = placedItems.map((item) => ({
      sequence: item.sequence,
      productId: item.productId,
      unitIndex: item.unitIndex,
      title: `Load unit ${item.unitIndex}`,
      instructions: `Place product ${item.productId} in ${item.zoneType} at x=${item.xMm}mm, y=${item.yMm}mm.`,
    }));
    const alerts = this.buildAlerts(input, placedItems, unplacedItems);
    const metrics = this.buildMetrics(input, placedItems, unplacedItems, alerts);

    return { placedItems, unplacedItems, steps, alerts, metrics };
  }

  private expandAndSortUnits(products: PlannerProductInput[], destinations: LoadingPlannerInput['destinations']) {
    const destinationById = new Map(destinations.map((destination) => [destination.id, destination]));
    const orders = destinations.map((destination) => destination.unloadingOrder).sort((a, b) => a - b);
    const units: Unit[] = [];

    for (const product of products) {
      const destinationOrder = product.destinationId ? destinationById.get(product.destinationId)?.unloadingOrder ?? 0 : 0;
      for (let unitIndex = 1; unitIndex <= product.quantity; unitIndex += 1) {
        units.push({
          ...product,
          unitIndex,
          destinationOrder,
          targetZone: this.targetZoneForOrder(destinationOrder, orders),
        });
      }
    }

    return units.sort((a, b) => {
      const orderDiff = b.destinationOrder - a.destinationOrder;
      if (orderDiff !== 0) return orderDiff;

      const weightDiff = (b.weightKg ?? 0) - (a.weightKg ?? 0);
      if (weightDiff !== 0) return weightDiff;

      return this.volumeMm3(b) - this.volumeMm3(a);
    });
  }

  private buildZones(truckZones: PlannerTruckZoneInput[], truckLength: number, truckWidth: number): ZoneCandidate[] {
    const fallbackLength = Math.floor(truckLength / 3);

    return ZONE_ORDER.map((type, index) => {
      const zone = truckZones.find((candidate) => candidate.type === type);
      const startXMm = zone?.startXMm ?? index * fallbackLength;
      const endXMm = zone?.endXMm ?? (index === ZONE_ORDER.length - 1 ? truckLength : (index + 1) * fallbackLength);

      return {
        id: zone?.id,
        type,
        bounds: {
          startXMm,
          endXMm,
          startYMm: zone?.startYMm ?? 0,
          endYMm: zone?.endYMm ?? truckWidth,
        },
        maxWeightKg: zone?.maxWeightKg,
      };
    });
  }

  private targetZoneForOrder(order: number, orders: number[]) {
    if (orders.length === 0 || order === 0) return TruckZoneType.CENTER;

    const index = orders.indexOf(order);
    if (index < 0) return TruckZoneType.CENTER;

    const ratio = index / Math.max(orders.length - 1, 1);
    if (ratio <= 0.33) return TruckZoneType.DOOR_SIDE;
    if (ratio >= 0.67) return TruckZoneType.CABIN_SIDE;
    return TruckZoneType.CENTER;
  }

  /**
   * Searches every candidate zone (target zone first, then fallbacks) for the
   * best feasible 3D position for `unit`, composing the existing zone→(x,y)
   * skyline scan with a Z-candidate search: `{0} ∪ {topZ(p) for placed p}`,
   * evaluated ascending (low CoG first) — descending when the unit is
   * fragile, which biases it toward higher tiers (soft rule, see
   * `chooseZoneCandidate`/`surfaces`).
   */
  private placeUnit(
    unit: Unit,
    zones: ZoneCandidate[],
    tiers: PlannerTruckTierInput[],
    placedItems: Placed[],
    truckHeight: number,
    truckWidth: number,
  ): PlaceOutcome {
    if (!this.hasRequiredDimensions(unit)) return { blockedByStacking: false };

    const targetZone = zones.find((zone) => zone.type === unit.targetZone);
    const fallbackZones = zones.filter((zone) => zone.type !== unit.targetZone);
    const orderedZones = targetZone ? [targetZone, ...fallbackZones] : fallbackZones;
    // Additive hard filter (loading-agent-llm 1.3): undefined = unrestricted (identity).
    const candidateZones = unit.allowedZones
      ? orderedZones.filter((zone) => unit.allowedZones!.includes(zone.type))
      : orderedZones;
    const orientations = this.orientations(unit);

    let blockedByStacking = false;
    const zoneCandidates: Array<{ zone: ZoneCandidate; candidate: PlacementCandidate }> = [];

    for (const zone of candidateZones) {
      const zoneItems = placedItems.filter((item) => item.zoneType === zone.type);
      const search = this.bestCandidateInZone(unit, zone, zoneItems, orientations, tiers, placedItems, truckHeight);
      if (search.blockedByStacking) blockedByStacking = true;
      if (search.candidate) zoneCandidates.push({ zone, candidate: search.candidate });
    }

    if (zoneCandidates.length === 0) return { blockedByStacking };

    const chosen = this.chooseZoneCandidate(zoneCandidates, unit, placedItems, truckWidth);
    return { item: this.toPlaced(unit, chosen), blockedByStacking: false };
  }

  /** Best feasible position within a single zone, across all orientations and Z-surfaces. */
  private bestCandidateInZone(
    unit: Unit,
    zone: ZoneCandidate,
    zoneItems: Placed[],
    orientations: Orientation[],
    tiers: PlannerTruckTierInput[],
    allPlacedItems: Placed[],
    truckHeight: number,
  ): { candidate?: PlacementCandidate; blockedByStacking: boolean } {
    let blockedByStacking = false;

    for (const orientation of orientations) {
      const surfaces = this.surfaces(zoneItems, unit.fragile);

      for (const surface of surfaces) {
        const bounds = this.surfaceBounds(zone, surface);
        const siblings = this.siblingsOnSurface(zoneItems, surface);
        const positions = this.xyCandidates(bounds, siblings);

        for (const position of positions) {
          const evaluation = this.evaluateCandidate(
            unit,
            zone,
            bounds,
            orientation,
            surface,
            position.xMm,
            position.yMm,
            allPlacedItems,
            tiers,
            truckHeight,
          );

          if (evaluation.candidate) return { candidate: evaluation.candidate, blockedByStacking: false };
          if (evaluation.blockedByStacking) blockedByStacking = true;
        }
      }
    }

    return { blockedByStacking };
  }

  /**
   * Candidate resting surfaces for a zone: the floor (z=0, tier 1), plus the
   * top of every item currently placed in the zone (tier = supporter's tier
   * + 1) — regardless of that item's own `stackable`/`fragile` flags, so the
   * caller can distinguish "no candidate at all" from "a geometrically valid
   * base existed but its stacking attributes disqualify it"
   * (`UnplacedReason.STACKING_RESTRICTION`).
   *
   * Sorted ascending by Z (low CoG first) by default; descending when
   * `preferUpperTier` is set (fragile items SHOULD land on higher tiers —
   * soft rule 1b.14).
   */
  private surfaces(zoneItems: Placed[], preferUpperTier: boolean): Surface[] {
    const floor: Surface = { zMm: 0, tier: 1 };
    const stacked: Surface[] = zoneItems.map((item) => ({
      zMm: topZ(this.toBox(item)),
      tier: item.tier + 1,
      supporter: item,
    }));

    return [floor, ...stacked].sort((a, b) => (preferUpperTier ? b.zMm - a.zMm : a.zMm - b.zMm));
  }

  /**
   * Candidate (x,y) positions for a surface, via a skyline scan (right/back
   * edges of siblings already resting there, plus each sibling's own origin)
   * bounded to the surface's own footprint: the zone bounds for the floor,
   * or the supporter's own footprint for a stacked surface — this lets
   * MULTIPLE smaller items share one large supporter's top (needed so
   * `maxStackLoadKg` can accumulate across siblings, not just gate a single
   * item), while still guaranteeing full containment (no floating) via the
   * bounds check itself, since every candidate position stays inside them.
   */
  private xyCandidates(surfaceBounds: Bounds, siblingItems: Placed[]): Array<{ xMm: number; yMm: number }> {
    const yCandidates = [...new Set([surfaceBounds.startYMm, ...siblingItems.map((item) => item.yMm), ...siblingItems.map((item) => item.yMm + item.widthMm)])].sort(
      (a, b) => a - b,
    );
    const xCandidates = [...new Set([surfaceBounds.startXMm, ...siblingItems.map((item) => item.xMm), ...siblingItems.map((item) => item.xMm + item.lengthMm)])].sort(
      (a, b) => a - b,
    );

    const positions: Array<{ xMm: number; yMm: number }> = [];
    for (const yMm of yCandidates) {
      for (const xMm of xCandidates) {
        positions.push({ xMm, yMm });
      }
    }
    return positions;
  }

  /** The footprint a surface's candidates must stay fully within: the zone bounds for the floor, or the supporter's own footprint when stacked. */
  private surfaceBounds(zone: ZoneCandidate, surface: Surface): Bounds {
    if (!surface.supporter) return zone.bounds;
    const supporter = surface.supporter;
    return {
      startXMm: supporter.xMm,
      endXMm: supporter.xMm + supporter.lengthMm,
      startYMm: supporter.yMm,
      endYMm: supporter.yMm + supporter.widthMm,
    };
  }

  /** Items already resting on this surface (floor items at z=0, or siblings directly supported by this surface's supporter). */
  private siblingsOnSurface(zoneItems: Placed[], surface: Surface): Placed[] {
    if (!surface.supporter) return zoneItems.filter((item) => item.zMm === 0);
    const supporter = surface.supporter;
    return zoneItems.filter((item) => item !== supporter && supports(this.toBox(item), this.toBox(supporter)));
  }

  /**
   * Evaluates every hard constraint for one candidate position. Returns
   * `blockedByStacking: true` only when the position was geometrically
   * sound (in-bounds, no overlap) but rejected specifically because of a
   * stacking rule on its supporter (non-stackable, fragile, or over
   * `maxStackLoadKg`) — this drives the accurate `STACKING_RESTRICTION`
   * unplaced reason when the whole search is exhausted.
   */
  private evaluateCandidate(
    unit: Unit,
    zone: ZoneCandidate,
    bounds: Bounds,
    orientation: Orientation,
    surface: Surface,
    xMm: number,
    yMm: number,
    allPlacedItems: Placed[],
    tiers: PlannerTruckTierInput[],
    truckHeight: number,
  ): { candidate?: PlacementCandidate; blockedByStacking: boolean } {
    const rect: Rect = { xMm, yMm, lengthMm: orientation.lengthMm, widthMm: orientation.widthMm };
    if (!isWithinBounds(rect, bounds)) return { blockedByStacking: false };

    const box: Box = { ...rect, zMm: surface.zMm, heightMm: unit.heightMm ?? 0 };

    if (truckHeight > 0 && !isWithinHeight(box, truckHeight)) return { blockedByStacking: false };

    // Additive hard filter (loading-agent-llm 1.3): undefined = unrestricted (identity).
    if (unit.maxTier !== undefined && surface.tier > unit.maxTier) return { blockedByStacking: false };

    const tier = tiers.find((candidate) => candidate.level === surface.tier);
    if (tier?.maxHeightMm !== undefined && (unit.heightMm ?? 0) > tier.maxHeightMm) return { blockedByStacking: false };

    if (allPlacedItems.some((placed) => overlaps3D(box, this.toBox(placed)))) return { blockedByStacking: false };

    if (surface.supporter) {
      const supporter = surface.supporter;
      if (!supporter.stackable || supporter.fragile) return { blockedByStacking: true };
      if (!supports(box, this.toBox(supporter))) return { blockedByStacking: true };

      if (supporter.maxStackLoadKg !== undefined) {
        const alreadyBearingKg = allPlacedItems
          .filter((placed) => placed !== supporter && supports(this.toBox(placed), this.toBox(supporter)))
          .reduce((sum, placed) => sum + placed.weightKg, 0);
        if (alreadyBearingKg + (unit.weightKg ?? 0) > supporter.maxStackLoadKg) return { blockedByStacking: true };
      }
    }

    if (tier?.maxWeightKg !== undefined) {
      const tierWeightKg = allPlacedItems
        .filter((placed) => placed.tier === surface.tier)
        .reduce((sum, placed) => sum + placed.weightKg, 0);
      if (tierWeightKg + (unit.weightKg ?? 0) > tier.maxWeightKg) return { blockedByStacking: false };
    }

    if (zone.maxWeightKg !== undefined) {
      const zoneWeightKg = allPlacedItems
        .filter((placed) => placed.zoneType === zone.type)
        .reduce((sum, placed) => sum + placed.weightKg, 0);
      if (zoneWeightKg + (unit.weightKg ?? 0) > zone.maxWeightKg) return { blockedByStacking: false };
    }

    return {
      candidate: { zone, orientation, xMm, yMm, zMm: surface.zMm, tier: surface.tier },
      blockedByStacking: false,
    };
  }

  /**
   * Chooses among the best candidate found per zone. Defaults to zone
   * priority order (target zone first). Soft rule 1b.13: if the priority
   * zone's candidate would push lateral (left/right) weight imbalance over
   * 20% and another zone's candidate would not, prefers the balanced one.
   */
  private chooseZoneCandidate(
    zoneCandidates: Array<{ zone: ZoneCandidate; candidate: PlacementCandidate }>,
    unit: Unit,
    placedItems: Placed[],
    truckWidth: number,
  ): PlacementCandidate {
    if (zoneCandidates.length === 1 || truckWidth <= 0) return zoneCandidates[0].candidate;

    const weightKg = unit.weightKg ?? 0;
    const imbalanceOf = (candidate: PlacementCandidate) => {
      const centerY = truckWidth / 2;
      const itemCenterY = candidate.yMm + candidate.orientation.widthMm / 2;
      const left = this.sideWeight(placedItems, truckWidth, 'left') + (itemCenterY <= centerY ? weightKg : 0);
      const right = this.sideWeight(placedItems, truckWidth, 'right') + (itemCenterY > centerY ? weightKg : 0);
      const total = left + right;
      return total > 0 ? Math.abs(left - right) / total : 0;
    };

    const priority = zoneCandidates[0];
    if (imbalanceOf(priority.candidate) <= 0.2) return priority.candidate;

    const balanced = zoneCandidates.find(({ candidate }) => imbalanceOf(candidate) <= 0.2);
    return (balanced ?? priority).candidate;
  }

  private toPlaced(unit: Unit, candidate: PlacementCandidate): Placed {
    return {
      productId: unit.id,
      unitIndex: unit.unitIndex,
      truckZoneId: candidate.zone.id,
      zoneType: candidate.zone.type,
      xMm: candidate.xMm,
      yMm: candidate.yMm,
      zMm: candidate.zMm,
      tier: candidate.tier,
      rotationDeg: candidate.orientation.rotationDeg,
      lengthMm: candidate.orientation.lengthMm,
      widthMm: candidate.orientation.widthMm,
      heightMm: unit.heightMm ?? 0,
      weightKg: unit.weightKg ?? 0,
      sequence: 0,
      stackable: unit.stackable,
      fragile: unit.fragile,
      maxStackLoadKg: unit.maxStackLoadKg,
    };
  }

  private unplacedReason(unit: Unit, blockedByStacking: boolean): UnplacedReason {
    if (!this.hasRequiredDimensions(unit)) return UnplacedReason.MANUAL_REVIEW_REQUIRED;
    return blockedByStacking ? UnplacedReason.STACKING_RESTRICTION : UnplacedReason.NO_AVAILABLE_SPACE;
  }

  private unplacedMessage(unit: Unit, blockedByStacking: boolean): string {
    if (!this.hasRequiredDimensions(unit)) return 'Product has missing or invalid dimensions for automatic planning.';
    return blockedByStacking
      ? 'No stackable base with enough remaining capacity was available to support this item.'
      : 'No floor space available in the target zone or fallback zones.';
  }

  private orientations(unit: Unit) {
    const lengthMm = unit.lengthMm ?? 0;
    const widthMm = unit.widthMm ?? 0;
    const orientations = [{ lengthMm, widthMm, rotationDeg: 0 }];

    if (unit.rotationAllowed !== false && lengthMm !== widthMm) {
      orientations.push({ lengthMm: widthMm, widthMm: lengthMm, rotationDeg: 90 });
    }

    return orientations;
  }

  private buildAlerts(
    input: LoadingPlannerInput,
    placedItems: PlannerPlacedItem[],
    unplacedItems: LoadingPlannerResult['unplacedItems'],
  ) {
    const alerts: LoadingPlannerResult['alerts'] = unplacedItems.map((item) => ({
      productId: item.productId,
      severity: AlertSeverity.CRITICAL,
      type: AlertType.UNPLACED_ITEM,
      message: `Product ${item.productId} unit ${item.unitIndex} was not placed: ${item.message}`,
    }));
    if (tierHeightsExceedTruck(input.truck.tiers, input.truck.heightMm ?? 0)) {
      alerts.push({
        severity: AlertSeverity.CRITICAL,
        type: AlertType.HEIGHT_EXCEEDED,
        message: `Configured tier stack exceeds truck height ${(input.truck.heightMm ?? 0).toFixed(0)}mm.`,
      });
    }

    const totalWeightKg = this.totalInputWeight(input.products);

    if (input.truck.maxPayloadKg !== undefined && totalWeightKg > input.truck.maxPayloadKg) {
      alerts.push({
        severity: AlertSeverity.CRITICAL,
        type: AlertType.MAX_WEIGHT_EXCEEDED,
        message: `Total load ${totalWeightKg.toFixed(3)}kg exceeds truck payload ${input.truck.maxPayloadKg.toFixed(3)}kg.`,
      });
    }

    const leftWeightKg = this.sideWeight(placedItems, input.truck.widthMm ?? 0, 'left');
    const rightWeightKg = this.sideWeight(placedItems, input.truck.widthMm ?? 0, 'right');
    const lateralWeightKg = leftWeightKg + rightWeightKg;
    if (lateralWeightKg > 0 && Math.abs(leftWeightKg - rightWeightKg) / lateralWeightKg > 0.2) {
      alerts.push({
        severity: AlertSeverity.WARNING,
        type: AlertType.WEIGHT_IMBALANCE,
        message: `Lateral load differs by more than 20%: left ${leftWeightKg.toFixed(3)}kg, right ${rightWeightKg.toFixed(3)}kg.`,
      });
    }

    const zoneWeights = this.zoneWeights(placedItems);
    const averageZoneWeight = (zoneWeights.cabin + zoneWeights.center + zoneWeights.door) / 3;
    if (averageZoneWeight > 0 && Math.max(zoneWeights.cabin, zoneWeights.center, zoneWeights.door) / averageZoneWeight > 1.6) {
      alerts.push({
        severity: AlertSeverity.WARNING,
        type: AlertType.WEIGHT_IMBALANCE,
        message: 'Zone load is concentrated in one third of the truck.',
      });
    }

    return alerts;
  }

  private buildMetrics(
    input: LoadingPlannerInput,
    placedItems: PlannerPlacedItem[],
    unplacedItems: LoadingPlannerResult['unplacedItems'],
    alerts: LoadingPlannerResult['alerts'],
  ) {
    const placedWeightKg = placedItems.reduce((sum, item) => sum + item.weightKg, 0);
    const totalWeightKg = this.totalInputWeight(input.products);
    const usedVolumeM3 = placedItems.reduce((sum, item) => sum + this.itemVolumeM3(item), 0);
    const truckVolumeM3 = ((input.truck.lengthMm ?? 0) * (input.truck.widthMm ?? 0) * (input.truck.heightMm ?? 0)) / 1_000_000_000;
    const zoneWeights = this.zoneWeights(placedItems);
    const weightMoments = placedItems.reduce(
      (sum, item) => ({
        x: sum.x + (item.xMm + item.lengthMm / 2) * item.weightKg,
        y: sum.y + (item.yMm + item.widthMm / 2) * item.weightKg,
        z: sum.z + (item.zMm + item.heightMm / 2) * item.weightKg,
      }),
      { x: 0, y: 0, z: 0 },
    );

    return {
      totalWeightKg,
      placedWeightKg,
      unplacedWeightKg: Math.max(totalWeightKg - placedWeightKg, 0),
      usedVolumeM3,
      volumeUtilizationPct: truckVolumeM3 > 0 ? (usedVolumeM3 / truckVolumeM3) * 100 : 0,
      placedItemCount: placedItems.length,
      unplacedItemCount: unplacedItems.length,
      leftWeightKg: this.sideWeight(placedItems, input.truck.widthMm ?? 0, 'left'),
      rightWeightKg: this.sideWeight(placedItems, input.truck.widthMm ?? 0, 'right'),
      cabinSideWeightKg: zoneWeights.cabin,
      centerWeightKg: zoneWeights.center,
      doorSideWeightKg: zoneWeights.door,
      criticalAlertCount: alerts.filter((alert) => alert.severity === AlertSeverity.CRITICAL).length,
      warningAlertCount: alerts.filter((alert) => alert.severity === AlertSeverity.WARNING).length,
      loadLengthMm: placedItems.reduce((max, item) => Math.max(max, item.xMm + item.lengthMm), 0),
      maxHeightMm: placedItems.reduce((max, item) => Math.max(max, item.zMm + item.heightMm), 0),
      centerOfGravityX: placedWeightKg > 0 ? weightMoments.x / placedWeightKg : undefined,
      centerOfGravityY: placedWeightKg > 0 ? weightMoments.y / placedWeightKg : undefined,
      centerOfGravityZ: placedWeightKg > 0 ? weightMoments.z / placedWeightKg : undefined,
    };
  }

  private hasRequiredDimensions(product: PlannerProductInput) {
    return (product.lengthMm ?? 0) > 0 && (product.widthMm ?? 0) > 0 && (product.heightMm ?? 0) > 0;
  }

  private totalInputWeight(products: PlannerProductInput[]) {
    return products.reduce((sum, product) => sum + (product.weightKg ?? 0) * product.quantity, 0);
  }

  private volumeMm3(product: PlannerProductInput) {
    return (product.lengthMm ?? 0) * (product.widthMm ?? 0) * (product.heightMm ?? 0);
  }

  private itemVolumeM3(item: { lengthMm: number; widthMm: number; heightMm: number }) {
    return (item.lengthMm * item.widthMm * item.heightMm) / 1_000_000_000;
  }

  private toBox(item: PlannerPlacedItem): Box {
    return { xMm: item.xMm, yMm: item.yMm, lengthMm: item.lengthMm, widthMm: item.widthMm, zMm: item.zMm, heightMm: item.heightMm };
  }

  private sideWeight(placedItems: PlannerPlacedItem[], truckWidth: number, side: 'left' | 'right') {
    const centerY = truckWidth / 2;
    return placedItems.reduce((sum, item) => {
      const itemCenterY = item.yMm + item.widthMm / 2;
      if (side === 'left' && itemCenterY <= centerY) return sum + item.weightKg;
      if (side === 'right' && itemCenterY > centerY) return sum + item.weightKg;
      return sum;
    }, 0);
  }

  private zoneWeights(placedItems: PlannerPlacedItem[]) {
    return placedItems.reduce(
      (sum, item) => ({
        cabin: sum.cabin + (item.zoneType === TruckZoneType.CABIN_SIDE ? item.weightKg : 0),
        center: sum.center + (item.zoneType === TruckZoneType.CENTER ? item.weightKg : 0),
        door: sum.door + (item.zoneType === TruckZoneType.DOOR_SIDE ? item.weightKg : 0),
      }),
      { cabin: 0, center: 0, door: 0 },
    );
  }
}
