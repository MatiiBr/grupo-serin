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
