import type { CreditStatus, CustomerStatus, DeliveryPlanStatus, DispatchOrderStatus, LoadingMethod, OperationStatus, OrderStatus, PlanStatus, ProductFamily, SellerPriority, TruckZoneType } from '@camiones/shared';

export interface OperationSummary {
  id: string;
  code: string;
  status: OperationStatus;
  name: string | null;
  notes: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  counts?: {
    destinations: number;
    products: number;
    plans: number;
  };
}

export interface CreateOperationPayload {
  code?: string;
  name?: string;
  notes?: string;
  scheduledAt?: string;
}

export interface TruckZone {
  id: string;
  type: TruckZoneType;
  maxWeightKg?: number;
  startXMm?: number;
  endXMm?: number;
  startYMm?: number;
  endYMm?: number;
}

export interface Truck {
  id: string;
  operationId: string;
  plate: string;
  description: string | null;
  loadingMethod: LoadingMethod;
  maxPayloadKg?: number;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  zones?: TruckZone[];
}

export interface UpsertTruckPayload {
  plate: string;
  description?: string;
  loadingMethod?: LoadingMethod;
  maxPayloadKg?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
}

export interface Destination {
  id: string;
  operationId: string;
  code: string | null;
  name: string;
  unloadingOrder: number;
  address: string | null;
  notes: string | null;
}

export interface DestinationPayload {
  code?: string;
  name: string;
  unloadingOrder: number;
  address?: string;
  notes?: string;
}

export interface Product {
  id: string;
  operationId: string;
  destinationId: string | null;
  code: string;
  family: ProductFamily;
  description: string | null;
  quantity: number;
  weightKg?: number;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  stackable: boolean;
  rotationAllowed: boolean;
}

export interface ProductPayload {
  destinationId?: string;
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

export interface ProductCatalog {
  id: string;
  code: string;
  family: ProductFamily;
  description: string | null;
  weightKg?: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  stackable: boolean;
  rotationAllowed: boolean;
  isActive: boolean;
}

export interface ProductCatalogPayload {
  code: string;
  family: ProductFamily;
  description?: string;
  weightKg?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  stackable?: boolean;
  rotationAllowed?: boolean;
  isActive?: boolean;
}

export interface DestinationCatalog {
  id: string;
  code: string | null;
  name: string;
  address: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface DestinationCatalogPayload {
  code?: string;
  name: string;
  address?: string;
  notes?: string;
  isActive?: boolean;
}

export interface TruckCatalog {
  id: string;
  plate: string;
  description: string | null;
  loadingMethod: LoadingMethod;
  maxPayloadKg?: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  isActive: boolean;
}

export interface TrailerCatalog {
  id: string;
  code: string;
  description: string | null;
  maxPayloadKg?: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  isActive: boolean;
}

export interface OperationDestinationAssignment {
  id: string;
  operationId: string;
  destinationCatalogId: string;
  unloadingOrder: number;
  notes: string | null;
  catalog?: DestinationCatalog;
}

export interface OperationProductAssignment {
  id: string;
  operationId: string;
  productCatalogId: string;
  operationDestinationId: string | null;
  quantity: number;
  weightKgOverride?: number | null;
  lengthMmOverride?: number | null;
  widthMmOverride?: number | null;
  heightMmOverride?: number | null;
  stackableOverride?: boolean | null;
  rotationAllowedOverride?: boolean | null;
  notes: string | null;
  catalog?: ProductCatalog;
  operationDestination?: OperationDestinationAssignment | null;
}

export interface OperationVehicleAssignment {
  id: string;
  operationId: string;
  truckCatalogId: string;
  trailerCatalogId: string | null;
  notes: string | null;
  truck?: TruckCatalog;
  trailer?: TrailerCatalog | null;
}

export interface OperationDetail extends OperationSummary {
  truck: Truck | null;
  destinations: Destination[];
  products: Product[];
  vehicleAssignment?: OperationVehicleAssignment | null;
  destinationAssignments?: OperationDestinationAssignment[];
  productAssignments?: OperationProductAssignment[];
  latestPlan: {
    id: string;
    version: number;
    status: PlanStatus;
    method: LoadingMethod;
    isCurrent: boolean;
    placedItemCount: number;
    unplacedItemCount: number;
    metrics: PlanMetrics | null;
    alerts: PlanAlert[];
    updatedAt: string;
  } | null;
}

export interface OperationProductAssignmentPayload {
  productCatalogId: string;
  operationDestinationId?: string | null;
  quantity?: number;
  weightKgOverride?: number;
  lengthMmOverride?: number;
  widthMmOverride?: number;
  heightMmOverride?: number;
  stackableOverride?: boolean;
  rotationAllowedOverride?: boolean;
  notes?: string;
}

export interface OperationDestinationAssignmentPayload {
  destinationCatalogId: string;
  unloadingOrder: number;
  notes?: string;
}

export interface UpsertOperationVehicleAssignmentPayload {
  truckCatalogId: string;
  trailerCatalogId?: string | null;
  notes?: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  taxId?: string | null;
  status: CustomerStatus;
  notes?: string | null;
}

export interface CustomerPayload {
  code: string;
  name: string;
  taxId?: string;
  notes?: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productCatalogId?: string | null;
  productCode: string;
  description?: string | null;
  quantity: number;
  weightKg?: number | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  notes?: string | null;
}

export interface Order {
  id: string;
  code: string;
  customerId: string;
  status: OrderStatus;
  creditStatus: CreditStatus;
  sellerPriority: SellerPriority;
  destinationCatalogId?: string | null;
  destinationName?: string | null;
  requestedDeliveryAt?: string | null;
  externalRef?: string | null;
  notes?: string | null;
  customer?: Customer;
  items?: OrderItem[];
}

export interface OrderPayload {
  code?: string;
  customerId: string;
  sellerPriority?: SellerPriority;
  destinationCatalogId?: string;
  destinationName?: string;
  requestedDeliveryAt?: string;
  externalRef?: string;
  notes?: string;
  items: Array<{
    productCatalogId?: string;
    productCode: string;
    description?: string;
    quantity?: number;
    weightKg?: number;
    lengthMm?: number;
    widthMm?: number;
    heightMm?: number;
    notes?: string;
  }>;
}

export interface DeliveryPlan {
  id: string;
  code: string;
  status: DeliveryPlanStatus;
  plannedDate?: string | null;
  notes?: string | null;
}

export interface DeliveryPlanPayload {
  code?: string;
  plannedDate?: string;
  notes?: string;
}

export interface DispatchOrderItem {
  id: string;
  dispatchOrderId: string;
  orderItemId: string;
  productCatalogId: string;
  productCodeSnapshot: string;
  descriptionSnapshot?: string | null;
  quantity: number;
  weightKg?: number | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
}

export interface DispatchOrder {
  id: string;
  code: string;
  status: DispatchOrderStatus;
  orderId: string;
  deliveryPlanId?: string | null;
  destinationCatalogId?: string | null;
  destinationNameSnapshot?: string | null;
  sellerPriority: SellerPriority;
  requestedDeliveryAt?: string | null;
  loadOperationId?: string | null;
  notes?: string | null;
  items?: DispatchOrderItem[];
  order?: Order;
  deliveryPlan?: DeliveryPlan | null;
}

export interface DispatchOrderPayload {
  orderId: string;
  code?: string;
  deliveryPlanId?: string;
  notes?: string;
}

export interface PlanMetrics {
  totalWeightKg?: number;
  placedWeightKg?: number;
  unplacedWeightKg?: number;
  usedVolumeM3?: number;
  volumeUtilizationPct?: number;
  placedItemCount: number;
  unplacedItemCount: number;
  leftWeightKg?: number;
  rightWeightKg?: number;
  cabinSideWeightKg?: number;
  centerWeightKg?: number;
  doorSideWeightKg?: number;
  criticalAlertCount: number;
  warningAlertCount: number;
  loadLengthMm?: number;
  maxHeightMm?: number;
  centerOfGravityX?: number;
  centerOfGravityY?: number;
  centerOfGravityZ?: number;
}

export interface LoadingPlanEvaluationPenalty {
  code: string;
  points: number;
  message: string;
}

export interface LoadingPlanEvaluation {
  score: number;
  hardViolationCount: number;
  softPenaltyTotal: number;
  penalties: LoadingPlanEvaluationPenalty[];
}

export interface PlanAlert {
  id: string;
  severity: string;
  type: string;
  message: string;
  productId?: string | null;
  placedItemId?: string | null;
  createdAt: string;
}

export interface PlacedItem {
  id: string;
  productId: string;
  unitIndex: number;
  productCode: string;
  productName: string;
  productFamily: ProductFamily;
  destinationName?: string;
  zoneType?: TruckZoneType;
  xMm: number;
  yMm: number;
  zMm: number;
  rotationDeg: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  locked: boolean;
  manuallyAdjusted: boolean;
}

export interface AdjustPlacedItemPayload {
  xMm?: number;
  yMm?: number;
  zMm?: number;
  rotationDeg?: number;
  locked?: boolean;
}

export interface LoadingStep {
  id: string;
  planId: string;
  placedItemId?: string | null;
  sequence: number;
  title: string;
  instructions?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UnplacedItem {
  id: string;
  productId: string;
  unitIndex: number;
  productCode: string;
  productName: string;
  productFamily: ProductFamily;
  destinationName?: string;
  reason: string;
  message: string;
}

export interface LoadingPlan {
  id: string;
  operationId: string;
  operationCode: string;
  operationStatus: OperationStatus;
  version: number;
  planStatus: PlanStatus;
  loadingMethod: LoadingMethod;
  isCurrent: boolean;
  placedItems: PlacedItem[];
  unplacedItems: UnplacedItem[];
  steps: LoadingStep[];
  alerts: PlanAlert[];
  metrics: PlanMetrics | null;
  evaluation?: LoadingPlanEvaluation | null;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string | null;
  alertCounts: { critical: number; warning: number };
}

export interface LoadingPlanReport {
  operation: OperationSummary;
  truck: Truck | null;
  destinations: Destination[];
  products: Array<Product & { destinationName?: string | null }>;
  plan: LoadingPlan;
}
