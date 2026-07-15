export interface Rect {
  xMm: number;
  yMm: number;
  lengthMm: number;
  widthMm: number;
}

export interface Bounds {
  startXMm: number;
  endXMm: number;
  startYMm: number;
  endYMm: number;
}

export function isWithinBounds(rect: Rect, bounds: Bounds) {
  return (
    rect.xMm >= bounds.startXMm &&
    rect.yMm >= bounds.startYMm &&
    rect.xMm + rect.lengthMm <= bounds.endXMm &&
    rect.yMm + rect.widthMm <= bounds.endYMm
  );
}

export function overlaps(a: Rect, b: Rect) {
  return !(
    a.xMm + a.lengthMm <= b.xMm ||
    b.xMm + b.lengthMm <= a.xMm ||
    a.yMm + a.widthMm <= b.yMm ||
    b.yMm + b.widthMm <= a.yMm
  );
}

export interface Box extends Rect {
  zMm: number;
  heightMm: number;
}

/**
 * True when two boxes collide in 3D: their XY footprints overlap AND their
 * Z ranges overlap. Items stacked directly on top of each other (touching,
 * non-overlapping Z ranges) are NOT a collision.
 */
export function overlaps3D(a: Box, b: Box) {
  const zOverlap = a.zMm < b.zMm + b.heightMm && b.zMm < a.zMm + a.heightMm;
  return overlaps(a, b) && zOverlap;
}

/** Top surface height (Z) of a placed box. */
export function topZ(box: Box) {
  return box.zMm + box.heightMm;
}

/** True when a box's top surface stays within the given max height (inclusive). */
export function isWithinHeight(box: Box, maxHeightMm: number) {
  return topZ(box) <= maxHeightMm;
}

/**
 * True when `supporter` directly supports `base`: `base` rests exactly on
 * the supporter's top surface and their XY footprints overlap. This is a
 * pairwise building block — full "no floating" coverage across multiple
 * supporters is a solver-level concern.
 */
export function supports(base: Box, supporter: Box) {
  return topZ(supporter) === base.zMm && overlaps(base, supporter);
}
