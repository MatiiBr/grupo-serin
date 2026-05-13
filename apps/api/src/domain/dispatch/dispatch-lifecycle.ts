import { CreditStatus, DispatchOrderStatus, OrderStatus } from '@prisma/client';

export function canCreateDispatchOrder(order: { status: OrderStatus; creditStatus: CreditStatus; itemCount: number }) {
  return order.status === OrderStatus.RELEASED && order.creditStatus === CreditStatus.RELEASED && order.itemCount > 0;
}

export function ensureDispatchReadyForLoading(dispatchOrder: { status: DispatchOrderStatus; itemCount: number }) {
  return dispatchOrder.status === DispatchOrderStatus.READY_TO_LOAD && dispatchOrder.itemCount > 0;
}

export function markReadyToLoad() {
  return { status: DispatchOrderStatus.READY_TO_LOAD };
}

export function markLoadOperationLinked() {
  return { status: DispatchOrderStatus.LOAD_OPERATION_LINKED };
}
