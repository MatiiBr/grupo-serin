import { CreditStatus, OrderStatus } from '@prisma/client';

export function canFeedDispatchDemand(order: { status: OrderStatus; creditStatus: CreditStatus }) {
  return order.status === OrderStatus.RELEASED && order.creditStatus === CreditStatus.RELEASED;
}

export function applyCreditHold() {
  return { status: OrderStatus.CREDIT_HELD, creditStatus: CreditStatus.HELD };
}

export function applyCreditRelease() {
  return { status: OrderStatus.RELEASED, creditStatus: CreditStatus.RELEASED };
}
