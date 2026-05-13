import { apiRequest, jsonBody } from './client';
import type { CreateOperationPayload, OperationDetail, OperationSummary } from './types';

export const operationsApi = {
  list: () => apiRequest<OperationSummary[]>('/operations'),
  get: (operationId: string) => apiRequest<OperationDetail>(`/operations/${operationId}`),
  create: (payload: CreateOperationPayload) =>
    apiRequest<OperationSummary>('/operations', { method: 'POST', body: jsonBody(payload) }),
};
