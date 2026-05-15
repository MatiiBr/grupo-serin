export const queryKeys = {
  customers: {
    search: () => ['customers'] as const,
  },
  destinationAssignments: {
    list: (operationId: string) => ['destination-assignments', operationId] as const,
  },
  destinationCatalog: {
    search: () => ['destination-catalog'] as const,
  },
  dispatchDemand: {
    list: () => ['dispatch-demand'] as const,
  },
  dispatchOrders: {
    list: () => ['dispatch-orders'] as const,
  },
  loadingPlan: {
    current: (operationId: string) => ['loading-plan', operationId] as const,
    report: (planId: string | undefined) => ['loading-plan-report', planId] as const,
  },
  operations: {
    list: () => ['operations'] as const,
    detail: (operationId: string) => ['operation', operationId] as const,
  },
  orders: {
    list: () => ['orders'] as const,
  },
  productAssignments: {
    list: (operationId: string) => ['product-assignments', operationId] as const,
  },
  productCatalog: {
    search: () => ['product-catalog'] as const,
  },
  trailerCatalog: {
    search: () => ['trailer-catalog'] as const,
  },
  truckCatalog: {
    search: () => ['truck-catalog'] as const,
  },
  vehicleAssignment: {
    detail: (operationId: string) => ['vehicle-assignment', operationId] as const,
  },
};
