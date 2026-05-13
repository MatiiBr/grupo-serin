import { apiRequest } from './client';
import type { AdjustPlacedItemPayload, LoadingPlan, LoadingPlanReport } from './types';

export const loadingPlansApi = {
  current: (operationId: string) =>
    apiRequest<LoadingPlan | null>(`/operations/${operationId}/loading-plans/current`, { allowNotFound: true }),
  generate: (operationId: string) =>
    apiRequest<LoadingPlan>(`/operations/${operationId}/loading-plans/generate`, { method: 'POST' }),
  approve: (planId: string) =>
    apiRequest<LoadingPlan>(`/loading-plans/${planId}/approve`, { method: 'POST' }),
  report: (planId: string) =>
    apiRequest<LoadingPlanReport>(`/loading-plans/${planId}/report`),
  adjustPlacedItem: (planId: string, placedItemId: string, payload: AdjustPlacedItemPayload) =>
    apiRequest<LoadingPlan>(`/loading-plans/${planId}/placed-items/${placedItemId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};
