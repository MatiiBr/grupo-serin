import { describe, expect, it } from 'vitest';
import { Box, isWithinHeight, overlaps3D, supports, topZ } from './geometry';

const box = (overrides: Partial<Box> = {}): Box => ({
  xMm: 0,
  yMm: 0,
  lengthMm: 1000,
  widthMm: 1000,
  zMm: 0,
  heightMm: 500,
  ...overrides,
});

describe('overlaps3D', () => {
  it('accepts items stacked at different Z with the same XY footprint (no collision)', () => {
    const a = box({ zMm: 0, heightMm: 500 });
    const b = box({ zMm: 500, heightMm: 400 });

    expect(overlaps3D(a, b)).toBe(false);
  });

  it('rejects same-tier overlapping footprint when Z ranges overlap', () => {
    const a = box({ zMm: 0, heightMm: 500 });
    const b = box({ zMm: 200, heightMm: 400 });

    expect(overlaps3D(a, b)).toBe(true);
  });

  it('does not overlap when XY footprints are disjoint, even if Z ranges overlap', () => {
    const a = box({ xMm: 0, yMm: 0, lengthMm: 500, widthMm: 500, zMm: 0, heightMm: 500 });
    const b = box({ xMm: 900, yMm: 900, lengthMm: 500, widthMm: 500, zMm: 0, heightMm: 500 });

    expect(overlaps3D(a, b)).toBe(false);
  });

  it('overlaps when XY footprints coincide and both sit at the same Z', () => {
    const a = box({ zMm: 0, heightMm: 500 });
    const b = box({ zMm: 0, heightMm: 500 });

    expect(overlaps3D(a, b)).toBe(true);
  });
});

describe('topZ', () => {
  it('returns the top surface height of a placed box', () => {
    expect(topZ(box({ zMm: 100, heightMm: 300 }))).toBe(400);
  });

  it('returns zMm when heightMm is 0', () => {
    expect(topZ(box({ zMm: 250, heightMm: 0 }))).toBe(250);
  });
});

describe('isWithinHeight', () => {
  it('accepts a box whose top surface lands exactly on the max height (inclusive bound)', () => {
    expect(isWithinHeight(box({ zMm: 0, heightMm: 2400 }), 2400)).toBe(true);
  });

  it('rejects a box whose top surface exceeds the max height', () => {
    expect(isWithinHeight(box({ zMm: 2000, heightMm: 500 }), 2400)).toBe(false);
  });
});

describe('supports', () => {
  it('accepts a base resting exactly on the supporter top surface with overlapping XY footprint', () => {
    const supporter = box({ xMm: 0, yMm: 0, lengthMm: 1000, widthMm: 1000, zMm: 0, heightMm: 500 });
    const base = box({ xMm: 0, yMm: 0, lengthMm: 1000, widthMm: 1000, zMm: 500, heightMm: 300 });

    expect(supports(base, supporter)).toBe(true);
  });

  it('rejects a base floating above the supporter (gap between top surface and base)', () => {
    const supporter = box({ xMm: 0, yMm: 0, lengthMm: 1000, widthMm: 1000, zMm: 0, heightMm: 400 });
    const base = box({ xMm: 0, yMm: 0, lengthMm: 1000, widthMm: 1000, zMm: 500, heightMm: 300 });

    expect(supports(base, supporter)).toBe(false);
  });

  it('rejects a base sitting at the correct Z but with no XY footprint overlap', () => {
    const supporter = box({ xMm: 0, yMm: 0, lengthMm: 500, widthMm: 500, zMm: 0, heightMm: 500 });
    const base = box({ xMm: 900, yMm: 900, lengthMm: 500, widthMm: 500, zMm: 500, heightMm: 300 });

    expect(supports(base, supporter)).toBe(false);
  });
});
