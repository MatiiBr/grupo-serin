import { OperationStatus, PlanStatus, TransportExitStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { canAuthorizeTransportExit } from './transport-exit-lifecycle';

describe('transport exit lifecycle', () => {
  it('requires approved loading, ready documents, and scale before exit authorization', () => {
    expect(
      canAuthorizeTransportExit(
        { status: TransportExitStatus.SCALED, docsReadyAt: new Date(), scaledAt: new Date() },
        { operationStatus: OperationStatus.APPROVED, currentPlanStatus: PlanStatus.APPROVED },
      ),
    ).toBe(true);

    expect(
      canAuthorizeTransportExit(
        { status: TransportExitStatus.DOCS_READY, docsReadyAt: new Date(), scaledAt: null },
        { operationStatus: OperationStatus.APPROVED, currentPlanStatus: PlanStatus.APPROVED },
      ),
    ).toBe(false);

    expect(
      canAuthorizeTransportExit(
        { status: TransportExitStatus.SCALED, docsReadyAt: new Date(), scaledAt: new Date() },
        { operationStatus: OperationStatus.PLAN_GENERATED, currentPlanStatus: PlanStatus.GENERATED },
      ),
    ).toBe(false);
  });
});
