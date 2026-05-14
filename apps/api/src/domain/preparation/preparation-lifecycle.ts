import { PreparationStatus, ReservationStatus } from '@prisma/client';

export interface PreparationLineInput {
  reservedQuantity: number;
  readyQuantity: number;
  discrepancyQuantity?: number;
}

export interface PreparationLineResult {
  reservedQuantity: number;
  readyQuantity: number;
  discrepancyQuantity: number;
}

export function calculatePreparationLine(input: PreparationLineInput): PreparationLineResult {
  const reservedQuantity = Math.max(0, input.reservedQuantity);
  const explicitDiscrepancy = Math.min(reservedQuantity, Math.max(0, input.discrepancyQuantity ?? 0));
  const readyQuantity = Math.min(reservedQuantity - explicitDiscrepancy, Math.max(0, input.readyQuantity));
  const missingQuantity = reservedQuantity - readyQuantity;

  return {
    reservedQuantity,
    readyQuantity,
    discrepancyQuantity: Math.min(reservedQuantity, Math.max(explicitDiscrepancy, missingQuantity)),
  };
}

export function resolvePreparationStatus(lines: PreparationLineResult[]) {
  const reservedQuantity = lines.reduce((sum, line) => sum + line.reservedQuantity, 0);
  const readyQuantity = lines.reduce((sum, line) => sum + line.readyQuantity, 0);
  const discrepancyQuantity = lines.reduce((sum, line) => sum + line.discrepancyQuantity, 0);

  let status: PreparationStatus = PreparationStatus.PICKING;
  if (reservedQuantity === 0) status = PreparationStatus.PENDING;
  else if (discrepancyQuantity > 0) status = PreparationStatus.DISCREPANCY;
  else if (readyQuantity === reservedQuantity) status = PreparationStatus.READY;

  return { status, reservedQuantity, readyQuantity, discrepancyQuantity };
}

export function canStartPreparation(reservation: { status: ReservationStatus; unreservedQuantity: number }) {
  return reservation.status === ReservationStatus.RESERVED && reservation.unreservedQuantity === 0;
}

export function canFeedLoading(preparation: { status: PreparationStatus; discrepancyQuantity: number }) {
  return preparation.status === PreparationStatus.READY && preparation.discrepancyQuantity === 0;
}
