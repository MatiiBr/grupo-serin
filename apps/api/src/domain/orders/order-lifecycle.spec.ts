import { CreditStatus, OrderStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { applyCreditHold, applyCreditRelease, canFeedDispatchDemand } from './order-lifecycle';

describe('order lifecycle', () => {
  it('allows only released orders with released credit to feed dispatch demand', () => {
    expect(canFeedDispatchDemand({ status: OrderStatus.RELEASED, creditStatus: CreditStatus.RELEASED })).toBe(true);
    expect(canFeedDispatchDemand({ status: OrderStatus.CREDIT_HELD, creditStatus: CreditStatus.HELD })).toBe(false);
    expect(canFeedDispatchDemand({ status: OrderStatus.RECEIVED, creditStatus: CreditStatus.PENDING })).toBe(false);
  });

  it('keeps credit hold and release as explicit order state transitions', () => {
    expect(applyCreditHold()).toEqual({ status: OrderStatus.CREDIT_HELD, creditStatus: CreditStatus.HELD });
    expect(applyCreditRelease()).toEqual({ status: OrderStatus.RELEASED, creditStatus: CreditStatus.RELEASED });
  });
});
