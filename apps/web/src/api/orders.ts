import { apiRequest, jsonBody } from './client';
import type { Order, OrderPayload } from './types';

export const ordersApi = {
  list: () => apiRequest<Order[]>('/orders'),
  dispatchDemand: () => apiRequest<Order[]>('/orders/dispatch-demand'),
  create: (payload: OrderPayload) => apiRequest<Order>('/orders', { method: 'POST', body: jsonBody(payload) }),
  holdCredit: (orderId: string) => apiRequest<Order>(`/orders/${orderId}/credit-hold`, { method: 'POST' }),
  releaseCredit: (orderId: string) => apiRequest<Order>(`/orders/${orderId}/credit-release`, { method: 'POST' }),
};
