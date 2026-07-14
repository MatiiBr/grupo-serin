import { describe, expect, it } from 'vitest';
import { applyLoadingLayersToPlacedItems, calculateAxleLoadSnapshots, resolveLoadingLayer } from './load-support';

describe('load support helpers', () => {
  it('resolves loading layers from adjusted z positions', () => {
    const layers = [
      { number: 1, label: 'Capa 1', groupLabel: 'Capas 1-4', minZMm: 0, maxZMm: 200 },
      { number: 2, label: 'Capa 2', groupLabel: 'Capas 1-4', minZMm: 200, maxZMm: 400 },
    ];

    expect(resolveLoadingLayer(0, layers)).toEqual(layers[0]);
    expect(resolveLoadingLayer(250, layers)).toEqual(layers[1]);
    expect(resolveLoadingLayer(400, layers)).toEqual(layers[1]);
  });

  it('calculates axle snapshots from adjusted item positions', () => {
    const snapshots = calculateAxleLoadSnapshots(
      [
        { code: 'FRONT', label: 'Delantero demo', startXMm: 0, endXMm: 2000, maxWeightKg: 1200, source: 'demo', notes: 'pending official validation' },
        { code: 'REAR', label: 'Trasero demo', startXMm: 2000, endXMm: 4000, maxWeightKg: 600, source: 'demo', notes: 'pending official validation' },
      ],
      [
        { xMm: 0, lengthMm: 2000, weightKg: 700 },
        { xMm: 2000, lengthMm: 2000, weightKg: 1000 },
      ],
    );

    expect(snapshots).toEqual([
      expect.objectContaining({ axleGroupCode: 'FRONT', computedWeightKg: 700, status: 'OK' }),
      expect.objectContaining({ axleGroupCode: 'REAR', computedWeightKg: 1000, status: 'EXCEEDED' }),
    ]);
  });

  it('applies loading layer metadata to manually adjusted placed items', () => {
    const placedItems = applyLoadingLayersToPlacedItems(
      [
        { id: 'placed-base', zMm: 0 },
        { id: 'placed-top', zMm: 250 },
      ],
      [
        { id: 'layer-1', number: 1, label: 'Capa 1', groupLabel: 'Capas 1-4', minZMm: 0, maxZMm: 200 },
        { id: 'layer-2', number: 2, label: 'Capa 2', groupLabel: 'Capas 1-4', minZMm: 200, maxZMm: 400 },
      ],
    );

    expect(placedItems).toEqual([
      expect.objectContaining({ id: 'placed-base', loadingLayerId: 'layer-1', layerNumber: 1 }),
      expect.objectContaining({ id: 'placed-top', loadingLayerId: 'layer-2', layerNumber: 2 }),
    ]);
  });
});
