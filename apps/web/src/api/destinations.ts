import { apiRequest, jsonBody } from './client';
import type { Destination, DestinationPayload } from './types';

interface DeleteResponse {
  id: string;
  deleted: boolean;
}

export const destinationsApi = {
  list: (operationId: string) => apiRequest<Destination[]>(`/operations/${operationId}/destinations`),
  create: (operationId: string, payload: DestinationPayload) =>
    apiRequest<Destination>(`/operations/${operationId}/destinations`, { method: 'POST', body: jsonBody(payload) }),
  update: (destinationId: string, payload: DestinationPayload) =>
    apiRequest<Destination>(`/destinations/${destinationId}`, { method: 'PATCH', body: jsonBody(payload) }),
  remove: (destinationId: string) => apiRequest<DeleteResponse>(`/destinations/${destinationId}`, { method: 'DELETE' }),
};
