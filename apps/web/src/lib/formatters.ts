import type { OperationProductAssignment, ProductCatalog } from '../api/types';

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function formatDateMaybe(value: string | null | undefined) {
  return value ? formatDate(value) : 'sin fecha';
}

export function formatProductDimensions(product: ProductCatalog | undefined) {
  if (!product) return 'dimensiones sin catalogo';
  return `${product.lengthMm ?? '-'} x ${product.widthMm ?? '-'} x ${product.heightMm ?? '-'} mm`;
}

export function formatAssignmentWeight(assignment: OperationProductAssignment, product: ProductCatalog | undefined) {
  return formatNumber(assignment.weightKgOverride ?? product?.weightKg, 'kg');
}

export function formatNumber(value: number | string | null | undefined, suffix: string) {
  if (value === undefined || value === null) return '-';
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? `${numericValue.toFixed(2)} ${suffix}` : '-';
}
