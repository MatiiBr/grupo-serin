import type { LoadingMethod, OperationStatus, PlanStatus, ProductFamily } from './enums';
import type { LoadingAlert, ProductReference, TruckReference, UUID } from './types';

export interface CreateLoadingPlanDto {
  truckId: UUID;
  loadingMethod: LoadingMethod;
  productIds: UUID[];
  notes?: string;
}

export interface UpdateLoadingPlanDto {
  operationStatus?: OperationStatus;
  planStatus?: PlanStatus;
  loadingMethod?: LoadingMethod;
  productIds?: UUID[];
  notes?: string;
}

export interface LoadingPlanDto {
  id: UUID;
  operationStatus: OperationStatus;
  planStatus: PlanStatus;
  loadingMethod: LoadingMethod;
  truck: TruckReference;
  products: ProductReference[];
  alerts: LoadingAlert[];
  notes?: string;
}

export interface ProductSearchDto {
  query?: string;
  family?: ProductFamily;
}

export interface ProductCatalogDto {
  id: UUID;
  code: string;
  family: ProductFamily;
  description?: string | null;
  weightKg?: number | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  stackable: boolean;
  rotationAllowed: boolean;
  isActive: boolean;
}

export interface CreateProductCatalogDto {
  code: string;
  family: ProductFamily;
  description?: string;
  weightKg?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  stackable?: boolean;
  rotationAllowed?: boolean;
}

export interface UpdateProductCatalogDto extends Partial<CreateProductCatalogDto> {
  isActive?: boolean;
}

export interface DestinationCatalogDto {
  id: UUID;
  code?: string | null;
  name: string;
  address?: string | null;
  notes?: string | null;
  isActive: boolean;
}

export interface CreateDestinationCatalogDto {
  code?: string;
  name: string;
  address?: string;
  notes?: string;
}

export interface UpdateDestinationCatalogDto extends Partial<CreateDestinationCatalogDto> {
  isActive?: boolean;
}

export interface TruckCatalogDto {
  id: UUID;
  plate: string;
  description?: string | null;
  loadingMethod: LoadingMethod;
  maxPayloadKg?: number | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  isActive: boolean;
}

export interface TrailerCatalogDto {
  id: UUID;
  code: string;
  description?: string | null;
  maxPayloadKg?: number | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  isActive: boolean;
}

export interface OperationDestinationAssignmentDto {
  id: UUID;
  operationId: UUID;
  destinationCatalogId: UUID;
  unloadingOrder: number;
  notes?: string | null;
  catalog?: DestinationCatalogDto;
}

export interface OperationProductAssignmentDto {
  id: UUID;
  operationId: UUID;
  productCatalogId: UUID;
  operationDestinationId?: UUID | null;
  quantity: number;
  weightKgOverride?: number | null;
  lengthMmOverride?: number | null;
  widthMmOverride?: number | null;
  heightMmOverride?: number | null;
  stackableOverride?: boolean | null;
  rotationAllowedOverride?: boolean | null;
  notes?: string | null;
  catalog?: ProductCatalogDto;
  operationDestination?: OperationDestinationAssignmentDto | null;
}

export interface UpsertOperationVehicleAssignmentDto {
  truckCatalogId: UUID;
  trailerCatalogId?: UUID | null;
  notes?: string;
}

export interface OperationVehicleAssignmentDto {
  id: UUID;
  operationId: UUID;
  truckCatalogId: UUID;
  trailerCatalogId?: UUID | null;
  notes?: string | null;
  truck?: TruckCatalogDto;
  trailer?: TrailerCatalogDto | null;
}

export interface CreateProductDto {
  destinationId?: UUID;
  code: string;
  family: ProductFamily;
  description?: string;
  quantity?: number;
  weightKg?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  stackable?: boolean;
  rotationAllowed?: boolean;
}

export interface UpdateProductDto {
  destinationId?: UUID | null;
  code?: string;
  family?: ProductFamily;
  description?: string;
  quantity?: number;
  weightKg?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  stackable?: boolean;
  rotationAllowed?: boolean;
}
