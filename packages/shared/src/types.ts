import type { AlertSeverity, AlertType, LoadingMethod, OperationStatus, PlanStatus, ProductFamily } from './enums';

export type ISODateString = string;
export type UUID = string;

export interface TruckReference {
  id: UUID;
  plate: string;
  maxPayloadKg?: number;
}

export interface ProductReference {
  id: UUID;
  family: ProductFamily;
  code: string;
  description?: string;
  weightKg?: number;
  stackable?: boolean;
  rotationAllowed?: boolean;
}

export interface LoadingAlert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  productId?: UUID;
}

export interface LoadingPlanSummary {
  id: UUID;
  operationStatus: OperationStatus;
  planStatus: PlanStatus;
  loadingMethod: LoadingMethod;
  truck: TruckReference;
  productCount: number;
  totalWeightKg?: number;
  alerts: LoadingAlert[];
  updatedAt: ISODateString;
}
