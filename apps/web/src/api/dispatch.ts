import { apiRequest, jsonBody } from './client';
import type { DeliveryPlan, DeliveryPlanPayload, DispatchOrder, DispatchOrderPayload, OperationSummary } from './types';

export const dispatchApi = {
  listDeliveryPlans: () => apiRequest<DeliveryPlan[]>('/dispatch/delivery-plans'),
  createDeliveryPlan: (payload: DeliveryPlanPayload) => apiRequest<DeliveryPlan>('/dispatch/delivery-plans', { method: 'POST', body: jsonBody(payload) }),
  listDispatchOrders: () => apiRequest<DispatchOrder[]>('/dispatch/dispatch-orders'),
  createDispatchOrder: (payload: DispatchOrderPayload) => apiRequest<DispatchOrder>('/dispatch/dispatch-orders', { method: 'POST', body: jsonBody(payload) }),
  markReady: (dispatchOrderId: string) => apiRequest<DispatchOrder>(`/dispatch/dispatch-orders/${dispatchOrderId}/ready`, { method: 'POST' }),
  createLoadOperation: (dispatchOrderId: string) => apiRequest<OperationSummary>(`/dispatch/dispatch-orders/${dispatchOrderId}/load-operation`, { method: 'POST' }),
};
