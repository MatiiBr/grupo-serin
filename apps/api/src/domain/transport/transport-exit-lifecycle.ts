import { OperationStatus, PlanStatus, TransportExitStatus } from '@prisma/client';

export function canAuthorizeTransportExit(gate: { status: TransportExitStatus; docsReadyAt?: Date | null; scaledAt?: Date | null }, loading: { operationStatus?: OperationStatus | null; currentPlanStatus?: PlanStatus | null }) {
  return gate.status === TransportExitStatus.SCALED && Boolean(gate.docsReadyAt) && Boolean(gate.scaledAt) && loading.operationStatus === OperationStatus.APPROVED && loading.currentPlanStatus === PlanStatus.APPROVED;
}

export function markTransportDocsReady() {
  return { status: TransportExitStatus.DOCS_READY, docsReadyAt: new Date(), blockedReason: null };
}

export function recordTransportScale() {
  return { status: TransportExitStatus.SCALED, scaledAt: new Date(), blockedReason: null };
}

export function authorizeTransportExit() {
  return { status: TransportExitStatus.AUTHORIZED_EXIT, authorizedAt: new Date(), blockedReason: null };
}

export function markTransportDispatched() {
  return { status: TransportExitStatus.DISPATCHED, dispatchedAt: new Date(), blockedReason: null };
}

export function blockTransportExit(blockedReason: string) {
  return { status: TransportExitStatus.BLOCKED, blockedReason };
}
