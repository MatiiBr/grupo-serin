import { ReservationStatus } from '@prisma/client';

export interface ReservationLineInput {
  requestedQuantity: number;
  availableQuantity: number;
}

export interface ReservationLineResult extends ReservationLineInput {
  reservedQuantity: number;
  unreservedQuantity: number;
}

export function calculateReservationLine(input: ReservationLineInput): ReservationLineResult {
  const requestedQuantity = Math.max(0, input.requestedQuantity);
  const availableQuantity = Math.max(0, input.availableQuantity);
  const reservedQuantity = Math.min(requestedQuantity, availableQuantity);

  return {
    requestedQuantity,
    availableQuantity,
    reservedQuantity,
    unreservedQuantity: requestedQuantity - reservedQuantity,
  };
}

export function resolveReservationStatus(lines: ReservationLineResult[]) {
  const requestedQuantity = lines.reduce((sum, line) => sum + line.requestedQuantity, 0);
  const reservedQuantity = lines.reduce((sum, line) => sum + line.reservedQuantity, 0);
  const unreservedQuantity = lines.reduce((sum, line) => sum + line.unreservedQuantity, 0);

  return {
    status: unreservedQuantity > 0 ? ReservationStatus.PARTIAL : ReservationStatus.RESERVED,
    requestedQuantity,
    reservedQuantity,
    unreservedQuantity,
  };
}

export function canFeedWarehousePreparation(reservation: { status: ReservationStatus; unreservedQuantity: number }) {
  return reservation.status === ReservationStatus.RESERVED && reservation.unreservedQuantity === 0;
}

export function releaseReservation() {
  return { status: ReservationStatus.RELEASED, releasedAt: new Date() };
}
