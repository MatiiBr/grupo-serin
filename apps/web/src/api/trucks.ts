import { apiRequest, jsonBody } from './client';
import type { OperationVehicleAssignment, TrailerCatalog, Truck, TruckCatalog, UpsertOperationVehicleAssignmentPayload, UpsertTruckPayload } from './types';

export const trucksApi = {
  searchCatalog: (query?: string) => apiRequest<TruckCatalog[]>(`/trucks${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  createCatalog: (payload: UpsertTruckPayload) => apiRequest<TruckCatalog>('/trucks', { method: 'POST', body: jsonBody(payload) }),
  updateCatalog: (truckId: string, payload: Partial<UpsertTruckPayload>) =>
    apiRequest<TruckCatalog>(`/trucks/${truckId}`, { method: 'PATCH', body: jsonBody(payload) }),
  searchTrailers: (query?: string) => apiRequest<TrailerCatalog[]>(`/trailers${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  createTrailer: (payload: { code: string; description?: string; maxPayloadKg?: number; lengthMm?: number; widthMm?: number; heightMm?: number }) =>
    apiRequest<TrailerCatalog>('/trailers', { method: 'POST', body: jsonBody(payload) }),
  getAssignment: (operationId: string) => apiRequest<OperationVehicleAssignment | null>(`/operations/${operationId}/vehicle`, { allowNotFound: true }),
  upsertAssignment: (operationId: string, payload: UpsertOperationVehicleAssignmentPayload) =>
    apiRequest<OperationVehicleAssignment>(`/operations/${operationId}/vehicle`, { method: 'PUT', body: jsonBody(payload) }),
  get: (operationId: string) => apiRequest<Truck | null>(`/operations/${operationId}/vehicle`, { allowNotFound: true }),
  upsert: (operationId: string, payload: UpsertTruckPayload) =>
    apiRequest<Truck>(`/operations/${operationId}/vehicle`, { method: 'PUT', body: jsonBody(payload) }),
};
