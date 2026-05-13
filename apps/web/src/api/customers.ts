import { apiRequest, jsonBody } from './client';
import type { Customer, CustomerPayload } from './types';

export const customersApi = {
  search: (query?: string) => apiRequest<Customer[]>(`/customers${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  create: (payload: CustomerPayload) => apiRequest<Customer>('/customers', { method: 'POST', body: jsonBody(payload) }),
};
