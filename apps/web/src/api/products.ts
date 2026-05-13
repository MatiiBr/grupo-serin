import { apiRequest, jsonBody } from './client';
import type { OperationProductAssignment, OperationProductAssignmentPayload, Product, ProductCatalog, ProductCatalogPayload, ProductPayload } from './types';

interface DeleteResponse {
  id: string;
  deleted: boolean;
}

export const productsApi = {
  searchCatalog: (query?: string) => apiRequest<ProductCatalog[]>(`/products${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  createCatalog: (payload: ProductCatalogPayload) => apiRequest<ProductCatalog>('/products', { method: 'POST', body: jsonBody(payload) }),
  updateCatalog: (productId: string, payload: Partial<ProductCatalogPayload>) =>
    apiRequest<ProductCatalog>(`/products/${productId}`, { method: 'PATCH', body: jsonBody(payload) }),
  removeCatalog: (productId: string) => apiRequest<DeleteResponse>(`/products/${productId}`, { method: 'DELETE' }),
  listAssignments: (operationId: string) => apiRequest<OperationProductAssignment[]>(`/operations/${operationId}/products`),
  createAssignment: (operationId: string, payload: OperationProductAssignmentPayload) =>
    apiRequest<OperationProductAssignment>(`/operations/${operationId}/products`, { method: 'POST', body: jsonBody(payload) }),
  updateAssignment: (assignmentId: string, payload: Partial<OperationProductAssignmentPayload>) =>
    apiRequest<OperationProductAssignment>(`/operation-products/${assignmentId}`, { method: 'PATCH', body: jsonBody(payload) }),
  removeAssignment: (assignmentId: string) => apiRequest<DeleteResponse>(`/operation-products/${assignmentId}`, { method: 'DELETE' }),
  list: (operationId: string) => apiRequest<Product[]>(`/operations/${operationId}/products`),
  create: (operationId: string, payload: ProductPayload) =>
    apiRequest<Product>(`/operations/${operationId}/products`, { method: 'POST', body: jsonBody(payload) }),
  remove: (productId: string) => apiRequest<DeleteResponse>(`/operation-products/${productId}`, { method: 'DELETE' }),
  duplicate: (productId: string) => apiRequest<Product>(`/products/${productId}/duplicate`, { method: 'POST' }),
};
