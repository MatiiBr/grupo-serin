import { apiRequest, jsonBody } from './client';
import type { Destination, DestinationCatalog, DestinationCatalogPayload, DestinationPayload, OperationDestinationAssignment, OperationDestinationAssignmentPayload } from './types';

interface DeleteResponse {
  id: string;
  deleted: boolean;
}

export const destinationsApi = {
  searchCatalog: (query?: string) => apiRequest<DestinationCatalog[]>(`/destinations${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  createCatalog: (payload: DestinationCatalogPayload) =>
    apiRequest<DestinationCatalog>('/destinations', { method: 'POST', body: jsonBody(payload) }),
  updateCatalog: (destinationId: string, payload: Partial<DestinationCatalogPayload>) =>
    apiRequest<DestinationCatalog>(`/destinations/${destinationId}`, { method: 'PATCH', body: jsonBody(payload) }),
  removeCatalog: (destinationId: string) => apiRequest<DeleteResponse>(`/destinations/${destinationId}`, { method: 'DELETE' }),
  listAssignments: (operationId: string) => apiRequest<OperationDestinationAssignment[]>(`/operations/${operationId}/destinations`),
  createAssignment: (operationId: string, payload: OperationDestinationAssignmentPayload) =>
    apiRequest<OperationDestinationAssignment>(`/operations/${operationId}/destinations`, { method: 'POST', body: jsonBody(payload) }),
  reorderAssignments: (operationId: string, ids: string[]) =>
    apiRequest<OperationDestinationAssignment[]>(`/operations/${operationId}/destinations/reorder`, { method: 'PATCH', body: jsonBody({ ids }) }),
  updateAssignment: (assignmentId: string, payload: Partial<OperationDestinationAssignmentPayload>) =>
    apiRequest<OperationDestinationAssignment>(`/operation-destinations/${assignmentId}`, { method: 'PATCH', body: jsonBody(payload) }),
  removeAssignment: (assignmentId: string) => apiRequest<DeleteResponse>(`/operation-destinations/${assignmentId}`, { method: 'DELETE' }),
  list: (operationId: string) => apiRequest<Destination[]>(`/operations/${operationId}/destinations`),
  create: (operationId: string, payload: DestinationPayload) =>
    apiRequest<Destination>(`/operations/${operationId}/destinations`, { method: 'POST', body: jsonBody(payload) }),
  update: (destinationId: string, payload: DestinationPayload) =>
    apiRequest<Destination>(`/operation-destinations/${destinationId}`, { method: 'PATCH', body: jsonBody(payload) }),
  remove: (destinationId: string) => apiRequest<DeleteResponse>(`/operation-destinations/${destinationId}`, { method: 'DELETE' }),
};
