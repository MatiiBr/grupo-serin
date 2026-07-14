import type { PlannerAxleGroupInput, PlannerAxleLoadSnapshot, PlannerLoadingLayer } from './loading-planner.types';

type AxlePlacedItem = {
  xMm: number;
  lengthMm: number;
  weightKg: number;
};

type IdentifiedLoadingLayer = PlannerLoadingLayer & { id?: string };

type LayeredPlacedItem = {
  id: string;
  zMm: number;
};

export function resolveLoadingLayer<T extends PlannerLoadingLayer>(zMm: number, loadingLayers: T[]) {
  return loadingLayers.find((layer, index) => zMm >= layer.minZMm && (zMm < layer.maxZMm || index === loadingLayers.length - 1));
}

export function calculateAxleLoadSnapshots(axleGroups: PlannerAxleGroupInput[], placedItems: AxlePlacedItem[]): PlannerAxleLoadSnapshot[] {
  return axleGroups.map((group) => {
    const computedWeightKg = round3(placedItems.reduce((sum, item) => {
      const centerX = item.xMm + item.lengthMm / 2;
      return centerX >= group.startXMm && centerX < group.endXMm ? sum + item.weightKg : sum;
    }, 0));

    return {
      axleGroupCode: group.code,
      axleGroupLabel: group.label,
      source: group.source,
      notes: group.notes,
      startXMm: group.startXMm,
      endXMm: group.endXMm,
      maxWeightKg: group.maxWeightKg,
      computedWeightKg,
      status: group.maxWeightKg > 0 ? (computedWeightKg > group.maxWeightKg ? 'EXCEEDED' : 'OK') : 'UNKNOWN',
    };
  });
}

export function applyLoadingLayersToPlacedItems<T extends LayeredPlacedItem>(placedItems: T[], loadingLayers: IdentifiedLoadingLayer[]) {
  return placedItems.map((item) => {
    const layer = resolveLoadingLayer(item.zMm, loadingLayers);
    return {
      ...item,
      loadingLayerId: layer?.id,
      layerNumber: layer?.number,
      layerLabel: layer?.label,
      layerGroupLabel: layer?.groupLabel,
    };
  });
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}
