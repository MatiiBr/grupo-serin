import { CreditStatus, DispatchOrderStatus, OrderStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { canCreateDispatchOrder, ensureDispatchReadyForLoading, markLoadOperationLinked, markReadyToLoad } from './dispatch-lifecycle';

describe('dispatch lifecycle', () => {
  it('creates dispatch orders only from released credited demand with items', () => {
    expect(canCreateDispatchOrder({ status: OrderStatus.RELEASED, creditStatus: CreditStatus.RELEASED, itemCount: 1 })).toBe(true);
    expect(canCreateDispatchOrder({ status: OrderStatus.CREDIT_HELD, creditStatus: CreditStatus.HELD, itemCount: 1 })).toBe(false);
    expect(canCreateDispatchOrder({ status: OrderStatus.RELEASED, creditStatus: CreditStatus.RELEASED, itemCount: 0 })).toBe(false);
  });

  it('hands off to loading only from ready dispatch snapshots', () => {
    expect(ensureDispatchReadyForLoading({ status: DispatchOrderStatus.READY_TO_LOAD, itemCount: 1 })).toBe(true);
    expect(ensureDispatchReadyForLoading({ status: DispatchOrderStatus.PLANNED, itemCount: 1 })).toBe(false);
    expect(ensureDispatchReadyForLoading({ status: DispatchOrderStatus.READY_TO_LOAD, itemCount: 0 })).toBe(false);
  });

  it('keeps dispatch status transitions explicit and outside LoadOperation', () => {
    expect(markReadyToLoad()).toEqual({ status: DispatchOrderStatus.READY_TO_LOAD });
    expect(markLoadOperationLinked()).toEqual({ status: DispatchOrderStatus.LOAD_OPERATION_LINKED });
  });
});
