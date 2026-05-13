import { apiRequest, jsonBody } from './client';
import type { Truck, UpsertTruckPayload } from './types';

export const trucksApi = {
  get: (operationId: string) => apiRequest<Truck | null>(`/operations/${operationId}/truck`, { allowNotFound: true }),
  upsert: (operationId: string, payload: UpsertTruckPayload) =>
    apiRequest<Truck>(`/operations/${operationId}/truck`, { method: 'PUT', body: jsonBody(payload) }),
};
