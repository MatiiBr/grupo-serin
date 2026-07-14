import { AlertSeverity, AlertType, LoadingMethod, TruckZoneType, UnplacedReason } from '@prisma/client';
import { Bounds, isWithinBounds, overlaps, Rect } from './geometry';
import { calculateAxleLoadSnapshots, resolveLoadingLayer } from './load-support';
import { LoadingPlanEvaluator } from './loading-plan-evaluator';
import {
  LoadingPlannerInput,
  LoadingPlannerResult,
  PlannerAxleGroupInput,
  PlannerCandidateExplanation,
  PlannerCandidateDiagnostics,
  PlannerLoadingLayer,
  PlannerPlacedItem,
  PlannerProductInput,
  PlannerTruckZoneInput,
} from './loading-planner.types';

interface Unit extends PlannerProductInput {
  unitIndex: number;
  destinationOrder: number;
  targetZone: TruckZoneType;
}

interface ZoneCandidate {
  id?: string;
  type: TruckZoneType;
  bounds: Bounds;
}

interface CandidateResult {
  index: number;
  name: string;
  result: LoadingPlannerResult;
}

interface CandidateOrdering {
  name: string;
  units: Unit[];
  placementStrategy?: 'lateral-balance' | 'best-fit-compact';
}

const ZONE_ORDER = [TruckZoneType.CABIN_SIDE, TruckZoneType.CENTER, TruckZoneType.DOOR_SIDE];

export class HeuristicLoadingPlanner {
  private readonly evaluator = new LoadingPlanEvaluator();

  generate(input: LoadingPlannerInput): LoadingPlannerResult {
    const truckLength = input.truck.lengthMm ?? 0;
    const truckWidth = input.truck.widthMm ?? 0;
    const truckHeight = input.truck.heightMm ?? 0;
    const zones = this.buildZones(input.truck.zones, truckLength, truckWidth);
    const units = this.expandUnits(input.products, input.destinations);

    return this.selectBestCandidate(this.candidateOrderings(units).map((candidate, index) => ({
      index,
      name: candidate.name,
      result: this.generateCandidate(input, candidate.units, zones, truckHeight, candidate.placementStrategy),
    })));
  }

  private generateCandidate(input: LoadingPlannerInput, units: Unit[], zones: ZoneCandidate[], truckHeight: number, placementStrategy?: CandidateOrdering['placementStrategy']): LoadingPlannerResult {
    const placedItems: PlannerPlacedItem[] = [];
    const unplacedItems: LoadingPlannerResult['unplacedItems'] = [];
    const loadingLayers = this.buildLoadingLayers(input.truck.heightMm ?? 0, input.truck.loadingLayers);

    for (const unit of units) {
      const placement = this.placeUnit(unit, zones, placedItems, truckHeight, input.truck.widthMm ?? 0, placementStrategy);

      if (placement) {
        placedItems.push({ ...placement, sequence: placedItems.length + 1 });
        continue;
      }

      unplacedItems.push({
        productId: unit.id,
        unitIndex: unit.unitIndex,
        reason: this.hasRequiredDimensions(unit) ? UnplacedReason.NO_AVAILABLE_SPACE : UnplacedReason.MANUAL_REVIEW_REQUIRED,
        message: this.hasRequiredDimensions(unit)
          ? 'No floor space available in the target zone or fallback zones.'
          : 'Product has missing or invalid dimensions for automatic planning.',
      });
    }

    this.assignLoadingLayers(placedItems, loadingLayers);
    this.assignOperationalSequence(placedItems, input.truck.loadingMethod, input.truck.widthMm ?? 0);

    const productCodeById = new Map(input.products.map((product) => [product.id, product.code]));
    const steps = [...placedItems].sort((a, b) => a.sequence - b.sequence).map((item) => ({
      sequence: item.sequence,
      productId: item.productId,
      unitIndex: item.unitIndex,
      title: `Cargar unidad ${item.unitIndex}`,
      instructions: `Ubicar ${productCodeById.get(item.productId) ?? 'producto'} en ${zoneTypeLabel(item.zoneType)}: x=${item.xMm} mm, y=${item.yMm} mm.`,
    }));
    const baseAlerts = this.buildAlerts(input, placedItems, unplacedItems);
    const metrics = this.buildMetrics(input, placedItems, unplacedItems, baseAlerts);
    const baseResult = { loadingLayers, placedItems, unplacedItems, steps, alerts: baseAlerts, metrics, axleLoadSnapshots: this.buildAxleLoadSnapshots(input.truck.axleGroups ?? [], placedItems) };
    const evaluation = this.evaluator.evaluate(input, baseResult);
    const alerts = [...baseAlerts, ...evaluation.alerts];
    const finalMetrics = {
      ...metrics,
      criticalAlertCount: alerts.filter((alert) => alert.severity === AlertSeverity.CRITICAL).length,
      warningAlertCount: alerts.filter((alert) => alert.severity === AlertSeverity.WARNING).length,
    };

    return {
      loadingLayers,
      placedItems,
      unplacedItems,
      steps,
      alerts,
      metrics: finalMetrics,
      evaluation,
      axleLoadSnapshots: baseResult.axleLoadSnapshots,
    };
  }

  private expandUnits(products: PlannerProductInput[], destinations: LoadingPlannerInput['destinations']) {
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

    return this.sortCurrent(units);
  }

  private candidateOrderings(units: Unit[]): CandidateOrdering[] {
    return this.uniqueOrderings([
      { name: 'current', units: this.sortCurrent(units) },
      { name: 'large-footprint-first', units: this.sortLargeFootprintFirst(units) },
      { name: 'light-first', units: this.sortLightFirst(units) },
      { name: 'volume-first', units: this.sortVolumeFirst(units) },
      { name: 'long-first', units: this.sortLongFirst(units) },
      { name: 'stack-friendly', units: this.sortStackFriendly(units) },
      { name: 'target-zone', units: this.sortTargetZone(units) },
      { name: 'balance-lateral', units: this.sortCurrent(units), placementStrategy: 'lateral-balance' },
      { name: 'best-fit-compact', units: this.sortLongFirst(units), placementStrategy: 'best-fit-compact' },
    ]);
  }

  private sortCurrent(units: Unit[]) {
    return [...units].sort((a, b) => {
      const orderDiff = b.destinationOrder - a.destinationOrder;
      if (orderDiff !== 0) return orderDiff;

      const weightDiff = (b.weightKg ?? 0) - (a.weightKg ?? 0);
      if (weightDiff !== 0) return weightDiff;

      return this.volumeMm3(b) - this.volumeMm3(a);
    });
  }

  private sortLightFirst(units: Unit[]) {
    return [...units].sort((a, b) => {
      const orderDiff = b.destinationOrder - a.destinationOrder;
      if (orderDiff !== 0) return orderDiff;

      const weightDiff = (a.weightKg ?? 0) - (b.weightKg ?? 0);
      if (weightDiff !== 0) return weightDiff;

      return this.volumeMm3(a) - this.volumeMm3(b);
    });
  }

  private sortVolumeFirst(units: Unit[]) {
    return [...units].sort((a, b) => {
      const orderDiff = b.destinationOrder - a.destinationOrder;
      if (orderDiff !== 0) return orderDiff;

      const volumeDiff = this.volumeMm3(b) - this.volumeMm3(a);
      if (volumeDiff !== 0) return volumeDiff;

      return (b.weightKg ?? 0) - (a.weightKg ?? 0);
    });
  }

  private sortLargeFootprintFirst(units: Unit[]) {
    return [...units].sort((a, b) => {
      const orderDiff = b.destinationOrder - a.destinationOrder;
      if (orderDiff !== 0) return orderDiff;

      const footprintDiff = this.footprintMm2(b) - this.footprintMm2(a);
      if (footprintDiff !== 0) return footprintDiff;

      return (b.weightKg ?? 0) - (a.weightKg ?? 0);
    });
  }

  private sortLongFirst(units: Unit[]) {
    return [...units].sort((a, b) => {
      const orderDiff = b.destinationOrder - a.destinationOrder;
      if (orderDiff !== 0) return orderDiff;

      const lengthDiff = Math.max(b.lengthMm ?? 0, b.widthMm ?? 0) - Math.max(a.lengthMm ?? 0, a.widthMm ?? 0);
      if (lengthDiff !== 0) return lengthDiff;

      return this.volumeMm3(b) - this.volumeMm3(a);
    });
  }

  private sortStackFriendly(units: Unit[]) {
    return [...units].sort((a, b) => {
      const orderDiff = b.destinationOrder - a.destinationOrder;
      if (orderDiff !== 0) return orderDiff;

      if (a.stackable !== b.stackable) return a.stackable ? -1 : 1;

      const weightDiff = (b.weightKg ?? 0) - (a.weightKg ?? 0);
      if (weightDiff !== 0) return weightDiff;

      return this.volumeMm3(b) - this.volumeMm3(a);
    });
  }

  private sortTargetZone(units: Unit[]) {
    return [...units].sort((a, b) => {
      const zoneDiff = ZONE_ORDER.indexOf(a.targetZone) - ZONE_ORDER.indexOf(b.targetZone);
      if (zoneDiff !== 0) return zoneDiff;

      return this.sortCurrent([a, b])[0] === a ? -1 : 1;
    });
  }

  private uniqueOrderings(orderings: CandidateOrdering[]) {
    const seen = new Set<string>();
    return orderings.filter((ordering) => {
      const key = `${ordering.placementStrategy ?? 'first-fit'}:${ordering.units.map((unit) => `${unit.id}:${unit.unitIndex}`).join('|')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private selectBestCandidate(candidates: CandidateResult[]) {
    const validAlternatives = candidates.filter((candidate) => this.isValidAlternative(candidate));
    const selectableCandidates = validAlternatives.length > 0 ? validAlternatives : candidates;
    const winner = selectableCandidates.reduce((best, candidate) => (this.isCandidateBetter(candidate, best) ? candidate : best));
    return {
      ...winner.result,
      candidateDiagnostics: this.buildCandidateDiagnostics(winner, candidates, validAlternatives),
    };
  }

  private buildCandidateDiagnostics(winner: CandidateResult, candidates: CandidateResult[], validAlternatives: CandidateResult[]): PlannerCandidateDiagnostics {
    const discardedCandidates = candidates.filter((candidate) => !this.isValidAlternative(candidate));
    const bestPartialCandidate = validAlternatives.length === 0 ? winner : undefined;

    return {
      winnerIndex: winner.index,
      winnerName: winner.name,
      winnerExplanation: this.explainWinner(winner, candidates),
      candidates: validAlternatives.map((candidate) => this.toCandidateDetail(candidate, winner, candidates)),
      bestPartialCandidate: bestPartialCandidate ? this.toCandidateDetail(bestPartialCandidate, winner, candidates) : undefined,
      discardedCandidates: discardedCandidates.map((candidate) => ({
        index: candidate.index,
        name: candidate.name,
        score: candidate.result.evaluation.score,
        hardViolationCount: candidate.result.evaluation.hardViolationCount,
        placedItemCount: candidate.result.placedItems.length,
        unplacedItemCount: candidate.result.unplacedItems.length,
        explanation: this.explainDiscardedCandidate(candidate, winner, candidates),
        reason: this.discardReason(candidate),
      })),
    };
  }

  private toCandidateDetail(candidate: CandidateResult, winner: CandidateResult, candidates: CandidateResult[]) {
    return {
      index: candidate.index,
      name: candidate.name,
      score: candidate.result.evaluation.score,
      hardViolationCount: candidate.result.evaluation.hardViolationCount,
      placedItemCount: candidate.result.placedItems.length,
      unplacedItemCount: candidate.result.unplacedItems.length,
      explanation: this.explainCandidate(candidate, winner, candidates),
      placedItems: candidate.result.placedItems,
      unplacedItems: candidate.result.unplacedItems,
      steps: candidate.result.steps,
      alerts: candidate.result.alerts,
      metrics: candidate.result.metrics,
      evaluation: candidate.result.evaluation,
      axleLoadSnapshots: candidate.result.axleLoadSnapshots,
    };
  }

  private isValidAlternative(candidate: CandidateResult) {
    return candidate.result.evaluation.hardViolationCount === 0 && candidate.result.unplacedItems.length === 0;
  }

  private buildLoadingLayers(truckHeightMm: number, configuredLayers?: LoadingPlannerInput['truck']['loadingLayers']): PlannerLoadingLayer[] {
    if (configuredLayers?.length) {
      return [...configuredLayers]
        .sort((a, b) => a.number - b.number)
        .map((layer) => ({
          number: layer.number,
          label: layer.label ?? `Capa ${layer.number}`,
          groupLabel: layer.groupLabel ?? this.layerGroupLabel(layer.number),
          minZMm: layer.minZMm,
          maxZMm: layer.maxZMm,
        }));
    }

    const layerCount = 12;
    const layerHeightMm = truckHeightMm > 0 ? truckHeightMm / layerCount : 1;
    return Array.from({ length: layerCount }, (_, index) => {
      const number = index + 1;
      return {
        number,
        label: `Capa ${number}`,
        groupLabel: this.layerGroupLabel(number),
        minZMm: Math.round(index * layerHeightMm),
        maxZMm: Math.round((index + 1) * layerHeightMm),
      };
    });
  }

  private assignLoadingLayers(placedItems: PlannerPlacedItem[], loadingLayers: PlannerLoadingLayer[]) {
    for (const item of placedItems) {
      const layer = this.layerForZ(item.zMm, loadingLayers);
      item.layerNumber = layer?.number;
      item.layerLabel = layer?.label;
      item.layerGroupLabel = layer?.groupLabel;
    }
  }

  private assignOperationalSequence(placedItems: PlannerPlacedItem[], loadingMethod: LoadingPlannerInput['truck']['loadingMethod'], truckWidth: number) {
    const orderedItems = [...placedItems].sort((a, b) => this.operationalSequenceCompare(a, b, loadingMethod, truckWidth));

    orderedItems.forEach((item, index) => {
      item.sequence = index + 1;
    });
  }

  private operationalSequenceCompare(a: PlannerPlacedItem, b: PlannerPlacedItem, loadingMethod: LoadingPlannerInput['truck']['loadingMethod'], truckWidth: number) {
    if (loadingMethod === LoadingMethod.REAR) {
      const xDiff = a.xMm - b.xMm;
      if (xDiff !== 0) return xDiff;
    }

    const zDiff = a.zMm - b.zMm;
    if (zDiff !== 0) return zDiff;

    const centerY = truckWidth / 2;
    const aCenterDistance = Math.abs((a.yMm + a.widthMm / 2) - centerY);
    const bCenterDistance = Math.abs((b.yMm + b.widthMm / 2) - centerY);
    const centerDistanceDiff = aCenterDistance - bCenterDistance;
    if (centerDistanceDiff !== 0) return centerDistanceDiff;

    return a.yMm - b.yMm
      || a.xMm - b.xMm
      || a.productId.localeCompare(b.productId)
      || a.unitIndex - b.unitIndex;
  }

  private layerForZ(zMm: number, loadingLayers: PlannerLoadingLayer[]) {
    return resolveLoadingLayer(zMm, loadingLayers);
  }

  private layerGroupLabel(layerNumber: number) {
    const groupStart = Math.floor((layerNumber - 1) / 4) * 4 + 1;
    const groupEnd = groupStart + 3;
    return `Capas ${groupStart}-${groupEnd}`;
  }

  private buildAxleLoadSnapshots(axleGroups: PlannerAxleGroupInput[], placedItems: PlannerPlacedItem[]) {
    return calculateAxleLoadSnapshots(axleGroups, placedItems);
  }

  private explainWinner(winner: CandidateResult, candidates: CandidateResult[]): PlannerCandidateExplanation {
    const tiedCandidates = candidates.filter((candidate) => candidate.index !== winner.index && this.hasEqualSelectionMetrics(candidate, winner));
    const strengths = this.relativeStrengths(winner, candidates.filter((candidate) => candidate.index !== winner.index));
    const tradeoffs = this.tradeoffs(winner, candidates);

    if (tiedCandidates.length > 0) {
      return {
        summary: `Ganó por desempate estable ante ${tiedCandidates.length} resultado(s) en empate de puntaje y alertas.`,
        strengths: strengths.length > 0 ? strengths : ['Mantuvo el orden base ante resultados equivalentes.'],
        tradeoffs,
      };
    }

    return {
      summary: `Ganó frente a ${Math.max(candidates.length - 1, 0)} intento(s) evaluado(s) por ${this.primaryWinnerReason(winner, candidates)}.`,
      strengths,
      tradeoffs,
    };
  }

  private explainCandidate(candidate: CandidateResult, winner: CandidateResult, candidates: CandidateResult[]): PlannerCandidateExplanation {
    const strengths = this.relativeStrengths(candidate, candidates.filter((other) => other.index !== candidate.index));
    const tradeoffs = this.tradeoffs(candidate, candidates);

    if (candidate.index === winner.index) {
      const tiedCandidates = candidates.filter((other) => other.index !== winner.index && this.hasEqualSelectionMetrics(other, winner));
      return {
        summary: tiedCandidates.length > 0 ? 'Ganó por desempate estable: mantuvo el orden base entre alternativas equivalentes.' : `Ganó por ${this.primaryWinnerReason(candidate, candidates)}.`,
        strengths,
        tradeoffs,
      };
    }

    return {
      summary: `Perdió frente a ${this.candidateLabel(winner.name)} por ${this.lossReason(candidate, winner)}.`,
      strengths,
      tradeoffs,
    };
  }

  private explainDiscardedCandidate(candidate: CandidateResult, winner: CandidateResult, candidates: CandidateResult[]): PlannerCandidateExplanation {
    return {
      summary: `Descartado como alternativa valida: ${this.discardReason(candidate)}`,
      strengths: this.relativeStrengths(candidate, candidates.filter((other) => other.index !== candidate.index)),
      tradeoffs: [...this.tradeoffs(candidate, candidates), `No se puede seleccionar porque ${this.lossReason(candidate, winner)}.`],
    };
  }

  private discardReason(candidate: CandidateResult) {
    const reasons: string[] = [];
    if (candidate.result.evaluation.hardViolationCount > 0) reasons.push(`tiene ${candidate.result.evaluation.hardViolationCount} violacion(es) critica(s)`);
    if (candidate.result.unplacedItems.length > 0) reasons.push(`deja ${candidate.result.unplacedItems.length} bulto(s) sin ubicar`);
    return reasons.length > 0 ? `${reasons.join(' y ')}.` : 'no cumple las reglas operativas duras.';
  }

  private relativeStrengths(candidate: CandidateResult, others: CandidateResult[]) {
    const strengths: string[] = [];
    if (others.some((other) => candidate.result.evaluation.hardViolationCount < other.result.evaluation.hardViolationCount)) strengths.push('Tiene menos violaciones críticas que otra alternativa.');
    if (others.some((other) => candidate.result.metrics.warningAlertCount < other.result.metrics.warningAlertCount)) strengths.push('Reduce la cantidad de advertencias.');
    if (others.some((other) => this.lateralImbalanceKg(candidate) < this.lateralImbalanceKg(other))) strengths.push('Logra mejor balance lateral de peso.');
    if (others.some((other) => candidate.result.unplacedItems.length < other.result.unplacedItems.length)) strengths.push('Deja menos bultos sin ubicar.');
    if (others.some((other) => candidate.result.metrics.loadLengthMm < other.result.metrics.loadLengthMm)) strengths.push('Ocupa menos largo del camión.');
    if (others.some((other) => candidate.result.evaluation.score > other.result.evaluation.score)) strengths.push('Tiene mejor puntaje que otra alternativa.');
    if (strengths.length === 0 && candidate.result.unplacedItems.length === 0) strengths.push('Ubica todos los bultos disponibles.');
    return strengths;
  }

  private tradeoffs(candidate: CandidateResult, candidates: CandidateResult[]) {
    const tradeoffs: string[] = [];
    const metrics = candidate.result.metrics;
    const lateralTotal = metrics.leftWeightKg + metrics.rightWeightKg;
    if (candidate.result.evaluation.hardViolationCount > 0) tradeoffs.push('Mantiene violaciones críticas pendientes.');
    if (candidate.result.unplacedItems.length > 0) tradeoffs.push(`${candidate.result.unplacedItems.length} bulto(s) quedan sin ubicar.`);
    if (lateralTotal > 0 && Math.abs(metrics.leftWeightKg - metrics.rightWeightKg) / lateralTotal > 0.2) tradeoffs.push('Todavía tiene desbalance lateral de peso.');
    if (candidate.result.alerts.some((alert) => alert.message.includes('concentrada en un tercio'))) tradeoffs.push('La carga queda concentrada en una zona del camión.');

    const shortestLength = Math.min(...candidates.map((other) => other.result.metrics.loadLengthMm));
    if (metrics.loadLengthMm > shortestLength) tradeoffs.push('Ocupa más largo que la alternativa más compacta.');

    return tradeoffs;
  }

  private primaryWinnerReason(winner: CandidateResult, candidates: CandidateResult[]) {
    const others = candidates.filter((candidate) => candidate.index !== winner.index);
    if (others.some((candidate) => winner.result.evaluation.hardViolationCount < candidate.result.evaluation.hardViolationCount)) return 'tener menos violaciones críticas';
    if (others.some((candidate) => winner.result.metrics.warningAlertCount < candidate.result.metrics.warningAlertCount)) return 'tener menos advertencias';
    if (others.some((candidate) => this.lateralImbalanceKg(winner) < this.lateralImbalanceKg(candidate))) return 'mejor balance lateral';
    if (others.some((candidate) => winner.result.unplacedItems.length < candidate.result.unplacedItems.length)) return 'dejar menos bultos sin ubicar';
    if (others.some((candidate) => winner.result.metrics.loadLengthMm < candidate.result.metrics.loadLengthMm)) return 'ocupar menos largo';
    return 'mejor puntaje';
  }

  private lossReason(candidate: CandidateResult, winner: CandidateResult) {
    if (candidate.result.evaluation.hardViolationCount > winner.result.evaluation.hardViolationCount) return 'tener más violaciones críticas';
    if (candidate.result.metrics.warningAlertCount > winner.result.metrics.warningAlertCount) return 'tener más advertencias';
    if (candidate.result.unplacedItems.length > winner.result.unplacedItems.length) return 'dejar más bultos sin ubicar';
    if (candidate.result.metrics.loadLengthMm > winner.result.metrics.loadLengthMm) return 'ocupar más largo';
    if (this.lateralImbalanceKg(candidate) > this.lateralImbalanceKg(winner)) return 'peor balance lateral';
    if (candidate.result.evaluation.score < winner.result.evaluation.score) return 'menor puntaje';
    return 'desempate estable por orden de evaluación';
  }

  private hasEqualSelectionMetrics(candidate: CandidateResult, winner: CandidateResult) {
    return candidate.result.evaluation.score === winner.result.evaluation.score
      && candidate.result.evaluation.hardViolationCount === winner.result.evaluation.hardViolationCount
      && candidate.result.placedItems.length === winner.result.placedItems.length;
  }

  private lateralImbalanceKg(candidate: CandidateResult) {
    return Math.abs(candidate.result.metrics.leftWeightKg - candidate.result.metrics.rightWeightKg);
  }

  private candidateLabel(name: string) {
    const labels: Record<string, string> = {
      current: 'Base automática',
      'light-first': 'Livianos primero',
      'large-footprint-first': 'Mayor huella primero',
      'volume-first': 'Mayor volumen primero',
      'long-first': 'Largos primero',
      'stack-friendly': 'Apilables como base',
      'best-fit-compact': 'Mejor encastre compacto',
      'target-zone': 'Agrupado por zona',
      'balance-lateral': 'Balance lateral',
    };

    return labels[name] ?? name;
  }

  private isCandidateBetter(candidate: CandidateResult, best: CandidateResult) {
    const candidateEvaluation = candidate.result.evaluation;
    const bestEvaluation = best.result.evaluation;
    if (candidateEvaluation.score !== bestEvaluation.score) return candidateEvaluation.score > bestEvaluation.score;
    if (candidateEvaluation.hardViolationCount !== bestEvaluation.hardViolationCount) return candidateEvaluation.hardViolationCount < bestEvaluation.hardViolationCount;
    if (candidate.result.placedItems.length !== best.result.placedItems.length) return candidate.result.placedItems.length > best.result.placedItems.length;
    return candidate.index < best.index;
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

  private placeUnit(unit: Unit, zones: ZoneCandidate[], placedItems: PlannerPlacedItem[], truckHeight: number, truckWidth: number, placementStrategy?: CandidateOrdering['placementStrategy']) {
    if (!this.hasRequiredDimensions(unit)) return undefined;
    if (truckHeight > 0 && (unit.heightMm ?? 0) > truckHeight) return undefined;

    const targetZone = zones.find((zone) => zone.type === unit.targetZone);
    const fallbackZones = zones.filter((zone) => zone.type !== unit.targetZone);
    const candidateZones = targetZone ? [targetZone, ...fallbackZones] : fallbackZones;
    const orientations = this.orientations(unit);

    for (const zone of candidateZones) {
      for (const orientation of orientations) {
        const placement = this.findPosition(zone.bounds, { ...orientation, heightMm: unit.heightMm ?? 0 }, placedItems, unit.weightKg ?? 0, truckWidth, truckHeight, placementStrategy);
        if (!placement) continue;

        return {
          productId: unit.id,
          unitIndex: unit.unitIndex,
          truckZoneId: zone.id,
          zoneType: zone.type,
          xMm: placement.xMm,
          yMm: placement.yMm,
          zMm: placement.zMm,
          rotationDeg: orientation.rotationDeg,
          lengthMm: orientation.lengthMm,
          widthMm: orientation.widthMm,
          heightMm: unit.heightMm ?? 0,
          weightKg: unit.weightKg ?? 0,
          stackable: unit.stackable,
          sequence: 0,
        };
      }
    }

    const truckBounds = this.enclosingBounds(zones);
    if (truckBounds) {
      for (const orientation of orientations) {
        const placement = this.findPosition(truckBounds, { ...orientation, heightMm: unit.heightMm ?? 0 }, placedItems, unit.weightKg ?? 0, truckWidth, truckHeight, placementStrategy);
        if (!placement) continue;

        const zone = this.zoneForPlacement(zones, { xMm: placement.xMm, yMm: placement.yMm, lengthMm: orientation.lengthMm, widthMm: orientation.widthMm })
          ?? targetZone
          ?? candidateZones[0];

        return {
          productId: unit.id,
          unitIndex: unit.unitIndex,
          truckZoneId: zone?.id,
          zoneType: zone?.type ?? unit.targetZone,
          xMm: placement.xMm,
          yMm: placement.yMm,
          zMm: placement.zMm,
          rotationDeg: orientation.rotationDeg,
          lengthMm: orientation.lengthMm,
          widthMm: orientation.widthMm,
          heightMm: unit.heightMm ?? 0,
          weightKg: unit.weightKg ?? 0,
          stackable: unit.stackable,
          sequence: 0,
        };
      }
    }

    return undefined;
  }

  private enclosingBounds(zones: ZoneCandidate[]): Bounds | undefined {
    if (zones.length === 0) return undefined;

    return {
      startXMm: Math.min(...zones.map((zone) => zone.bounds.startXMm)),
      endXMm: Math.max(...zones.map((zone) => zone.bounds.endXMm)),
      startYMm: Math.min(...zones.map((zone) => zone.bounds.startYMm)),
      endYMm: Math.max(...zones.map((zone) => zone.bounds.endYMm)),
    };
  }

  private zoneForPlacement(zones: ZoneCandidate[], rect: Rect) {
    const centerX = rect.xMm + rect.lengthMm / 2;
    const centerY = rect.yMm + rect.widthMm / 2;

    return zones.find((zone) => centerX >= zone.bounds.startXMm
      && centerX < zone.bounds.endXMm
      && centerY >= zone.bounds.startYMm
      && centerY < zone.bounds.endYMm);
  }

  private findPosition(bounds: Bounds, item: { lengthMm: number; widthMm: number; heightMm: number }, placedItems: PlannerPlacedItem[], weightKg: number, truckWidth: number, truckHeight: number, placementStrategy?: CandidateOrdering['placementStrategy']) {
    const centerY = truckWidth / 2;
    const lateralBalanceAnchors = placementStrategy === 'lateral-balance'
      ? [centerY, centerY - item.widthMm, centerY - item.widthMm / 2, bounds.endYMm - item.widthMm]
      : [];
    const yCandidates = [...new Set([
      bounds.startYMm,
      ...placedItems.map((item) => item.yMm + item.widthMm),
      ...lateralBalanceAnchors,
    ].filter((candidate) => Number.isFinite(candidate) && candidate >= 0))].sort((a, b) => a - b);
    const xCandidates = [bounds.startXMm, ...placedItems.map((item) => item.xMm + item.lengthMm)].sort((a, b) => a - b);
    const validPositions: Array<{ xMm: number; yMm: number; zMm: number; lateralImbalanceKg: number }> = [];

    for (const yMm of yCandidates) {
      for (const xMm of xCandidates) {
        const zMm = 0;
        const rect = { xMm, yMm, lengthMm: item.lengthMm, widthMm: item.widthMm };
        if (!isWithinBounds(rect, bounds)) continue;
        if (this.has3DOverlap({ ...rect, zMm, heightMm: item.heightMm }, placedItems)) continue;

        if (!placementStrategy) return { xMm, yMm, zMm };
        if (placementStrategy === 'lateral-balance' && placedItems.length === 0) return { xMm, yMm, zMm };

        const leftWeightKg = this.sideWeight(placedItems, truckWidth, 'left') + this.rectSideWeight(rect, weightKg, truckWidth, 'left');
        const rightWeightKg = this.sideWeight(placedItems, truckWidth, 'right') + this.rectSideWeight(rect, weightKg, truckWidth, 'right');
        validPositions.push({ xMm, yMm, zMm, lateralImbalanceKg: Math.abs(leftWeightKg - rightWeightKg) });
      }
    }

    for (const position of this.stackPositions(bounds, item, placedItems)) {
      const candidate = { ...position, lengthMm: item.lengthMm, widthMm: item.widthMm, heightMm: item.heightMm };
      if (truckHeight > 0 && position.zMm + item.heightMm > truckHeight) continue;
      if (this.has3DOverlap(candidate, placedItems)) continue;

      if (!placementStrategy) return position;

      const rect = { xMm: position.xMm, yMm: position.yMm, lengthMm: item.lengthMm, widthMm: item.widthMm };
      const leftWeightKg = this.sideWeight(placedItems, truckWidth, 'left') + this.rectSideWeight(rect, weightKg, truckWidth, 'left');
      const rightWeightKg = this.sideWeight(placedItems, truckWidth, 'right') + this.rectSideWeight(rect, weightKg, truckWidth, 'right');
      validPositions.push({ ...position, lateralImbalanceKg: Math.abs(leftWeightKg - rightWeightKg) });
    }

    return validPositions.sort((a, b) => {
      if (placementStrategy === 'best-fit-compact') {
        return (a.xMm + item.lengthMm) - (b.xMm + item.lengthMm) || a.zMm - b.zMm || a.yMm - b.yMm || a.lateralImbalanceKg - b.lateralImbalanceKg;
      }

      return a.lateralImbalanceKg - b.lateralImbalanceKg || a.xMm - b.xMm || a.yMm - b.yMm || a.zMm - b.zMm;
    })[0];
  }

  private stackPositions(bounds: Bounds, item: { lengthMm: number; widthMm: number }, placedItems: PlannerPlacedItem[]) {
    return placedItems.flatMap((base) => {
      if (!base.stackable) return [];
      const xMm = base.xMm;
      const yMm = base.yMm;
      const zMm = base.zMm + base.heightMm;
      const rect = { xMm, yMm, lengthMm: item.lengthMm, widthMm: item.widthMm };

      if (!isWithinBounds(rect, bounds)) return [];
      if (!isWithinRect(rect, this.toRect(base))) return [];

      return [{ xMm, yMm, zMm }];
    });
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
        message: `El producto ${item.productId}, unidad ${item.unitIndex}, no pudo ubicarse: ${item.message}`,
    }));
    const totalWeightKg = this.totalInputWeight(input.products);

    if (input.truck.maxPayloadKg !== undefined && totalWeightKg > input.truck.maxPayloadKg) {
      alerts.push({
        severity: AlertSeverity.CRITICAL,
        type: AlertType.MAX_WEIGHT_EXCEEDED,
        message: `La carga total (${formatKg(totalWeightKg)}) supera la capacidad del camion (${formatKg(input.truck.maxPayloadKg)}).`,
      });
    }

    const leftWeightKg = this.sideWeight(placedItems, input.truck.widthMm ?? 0, 'left');
    const rightWeightKg = this.sideWeight(placedItems, input.truck.widthMm ?? 0, 'right');
    const lateralWeightKg = leftWeightKg + rightWeightKg;
    if (lateralWeightKg > 0 && Math.abs(leftWeightKg - rightWeightKg) / lateralWeightKg > 0.2) {
      alerts.push({
        severity: AlertSeverity.WARNING,
        type: AlertType.WEIGHT_IMBALANCE,
        message: `El peso lateral difiere mas de 20%: izquierda ${formatKg(leftWeightKg)}, derecha ${formatKg(rightWeightKg)}.`,
      });
    }

    const zoneWeights = this.zoneWeights(placedItems);
    const averageZoneWeight = (zoneWeights.cabin + zoneWeights.center + zoneWeights.door) / 3;
    if (averageZoneWeight > 0 && Math.max(zoneWeights.cabin, zoneWeights.center, zoneWeights.door) / averageZoneWeight > 1.6) {
      alerts.push({
        severity: AlertSeverity.WARNING,
        type: AlertType.WEIGHT_IMBALANCE,
        message: 'La carga quedo concentrada en un tercio del camion.',
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

  private footprintMm2(product: PlannerProductInput) {
    return (product.lengthMm ?? 0) * (product.widthMm ?? 0);
  }

  private itemVolumeM3(item: { lengthMm: number; widthMm: number; heightMm: number }) {
    return (item.lengthMm * item.widthMm * item.heightMm) / 1_000_000_000;
  }

  private toRect(item: PlannerPlacedItem): Rect {
    return { xMm: item.xMm, yMm: item.yMm, lengthMm: item.lengthMm, widthMm: item.widthMm };
  }

  private has3DOverlap(item: Rect & { zMm: number; heightMm: number }, placedItems: PlannerPlacedItem[]) {
    return placedItems.some((placed) => {
      if (!overlaps(item, this.toRect(placed))) return false;
      const itemTop = item.zMm + item.heightMm;
      const placedTop = placed.zMm + placed.heightMm;
      return !(itemTop <= placed.zMm || placedTop <= item.zMm);
    });
  }

  private sideWeight(placedItems: PlannerPlacedItem[], truckWidth: number, side: 'left' | 'right') {
    return placedItems.reduce((sum, item) => {
      return sum + this.rectSideWeight(this.toRect(item), item.weightKg, truckWidth, side);
    }, 0);
  }

  private rectSideWeight(rect: Rect, weightKg: number, truckWidth: number, side: 'left' | 'right') {
    const centerY = truckWidth / 2;
    const leftWidthMm = Math.max(0, Math.min(rect.yMm + rect.widthMm, centerY) - rect.yMm);
    const rightWidthMm = Math.max(0, rect.yMm + rect.widthMm - Math.max(rect.yMm, centerY));
    const itemWidthMm = leftWidthMm + rightWidthMm;
    if (itemWidthMm <= 0) return 0;

    return weightKg * (side === 'left' ? leftWidthMm : rightWidthMm) / itemWidthMm;
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

function formatKg(value: number) {
  return `${value.toFixed(1)} kg`;
}

function zoneTypeLabel(zoneType: TruckZoneType) {
  const labels: Record<TruckZoneType, string> = {
    [TruckZoneType.CABIN_SIDE]: 'zona cabina',
    [TruckZoneType.CENTER]: 'zona central',
    [TruckZoneType.DOOR_SIDE]: 'zona puerta',
  };

  return labels[zoneType] ?? zoneType;
}

function isWithinRect(rect: Rect, base: Rect) {
  return (
    rect.xMm >= base.xMm &&
    rect.yMm >= base.yMm &&
    rect.xMm + rect.lengthMm <= base.xMm + base.lengthMm &&
    rect.yMm + rect.widthMm <= base.yMm + base.widthMm
  );
}
