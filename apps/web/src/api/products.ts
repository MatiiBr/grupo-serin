import { apiRequest, jsonBody } from './client';
import type { Product, ProductPayload } from './types';

interface DeleteResponse {
  id: string;
  deleted: boolean;
}

export const productsApi = {
  list: (operationId: string) => apiRequest<Product[]>(`/operations/${operationId}/products`),
  create: (operationId: string, payload: ProductPayload) =>
    apiRequest<Product>(`/operations/${operationId}/products`, { method: 'POST', body: jsonBody(payload) }),
  remove: (productId: string) => apiRequest<DeleteResponse>(`/products/${productId}`, { method: 'DELETE' }),
  duplicate: (productId: string) => apiRequest<Product>(`/products/${productId}/duplicate`, { method: 'POST' }),
};
