import type {
  CustomsReleaseStatus,
  CreditStatus,
  CustomerStatus,
  DeliveryPlanStatus,
  DispatchOrderStatus,
  LoadingMethod,
  OperationStatus,
  OrderStatus,
  PlanStatus,
  PreparationStatus,
  ProductFamily,
  ReservationStatus,
  SellerPriority,
  TransportExitStatus,
  AuditAction,
  AuditSource,
} from './enums';
import type { ISODateString, LoadingAlert, ProductReference, TruckReference, UUID } from './types';

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

export interface CustomerDto {
  id: UUID;
  code: string;
  name: string;
  taxId?: string | null;
  status: CustomerStatus;
  notes?: string | null;
}

export interface CreateCustomerDto {
  code: string;
  name: string;
  taxId?: string;
  notes?: string;
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {
  status?: CustomerStatus;
}

export interface OrderItemDto {
  id: UUID;
  orderId: UUID;
  productCatalogId?: UUID | null;
  productCode: string;
  description?: string | null;
  quantity: number;
  weightKg?: number | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  notes?: string | null;
}

export interface CreateOrderItemDto {
  productCatalogId?: UUID;
  productCode: string;
  description?: string;
  quantity?: number;
  weightKg?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  notes?: string;
}

export interface OrderDto {
  id: UUID;
  code: string;
  customerId: UUID;
  status: OrderStatus;
  creditStatus: CreditStatus;
  sellerPriority: SellerPriority;
  destinationCatalogId?: UUID | null;
  destinationName?: string | null;
  requestedDeliveryAt?: ISODateString | null;
  externalRef?: string | null;
  notes?: string | null;
  customer?: CustomerDto;
  items?: OrderItemDto[];
}

export interface CreateOrderDto {
  code?: string;
  customerId: UUID;
  sellerPriority?: SellerPriority;
  destinationCatalogId?: UUID;
  destinationName?: string;
  requestedDeliveryAt?: ISODateString;
  externalRef?: string;
  notes?: string;
  items: CreateOrderItemDto[];
}

export interface DeliveryPlanDto {
  id: UUID;
  code: string;
  status: DeliveryPlanStatus;
  plannedDate?: ISODateString | null;
  notes?: string | null;
}

export interface DispatchOrderItemDto {
  id: UUID;
  dispatchOrderId: UUID;
  orderItemId: UUID;
  productCatalogId: UUID;
  productCodeSnapshot: string;
  descriptionSnapshot?: string | null;
  quantity: number;
  weightKg?: number | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
}

export interface DispatchOrderDto {
  id: UUID;
  code: string;
  status: DispatchOrderStatus;
  orderId: UUID;
  deliveryPlanId?: UUID | null;
  destinationCatalogId?: UUID | null;
  destinationNameSnapshot?: string | null;
  sellerPriority: SellerPriority;
  requestedDeliveryAt?: ISODateString | null;
  loadOperationId?: UUID | null;
  notes?: string | null;
  items?: DispatchOrderItemDto[];
  order?: OrderDto;
  deliveryPlan?: DeliveryPlanDto | null;
  customsRelease?: CustomsReleaseDto | null;
  transportExit?: TransportExitDto | null;
}

export interface CreateDeliveryPlanDto {
  code?: string;
  plannedDate?: ISODateString;
  notes?: string;
}

export interface CreateDispatchOrderDto {
  orderId: UUID;
  code?: string;
  deliveryPlanId?: UUID;
  notes?: string;
}

export interface ReservationItemDto {
  id: UUID;
  reservationId: UUID;
  dispatchOrderItemId: UUID;
  productCatalogId: UUID;
  productCodeSnapshot: string;
  requestedQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  unreservedQuantity: number;
}

export interface ReservationDto {
  id: UUID;
  dispatchOrderId: UUID;
  status: ReservationStatus;
  requestedQuantity: number;
  reservedQuantity: number;
  unreservedQuantity: number;
  externalRef?: string | null;
  notes?: string | null;
  createdAt: ISODateString;
  releasedAt?: ISODateString | null;
  items?: ReservationItemDto[];
  dispatchOrder?: DispatchOrderDto;
}

export interface ReservationAvailabilityDto {
  dispatchOrderItemId: UUID;
  availableQuantity: number;
}

export interface CreateReservationDto {
  dispatchOrderId: UUID;
  availability: ReservationAvailabilityDto[];
  externalRef?: string;
  notes?: string;
}

export interface PreparationItemDto {
  id: UUID;
  preparationId: UUID;
  reservationItemId: UUID;
  productCodeSnapshot: string;
  reservedQuantity: number;
  readyQuantity: number;
  discrepancyQuantity: number;
  discrepancyReason?: string | null;
}

export interface PreparationDto {
  id: UUID;
  reservationId: UUID;
  dispatchOrderId: UUID;
  status: PreparationStatus;
  requestedQuantity: number;
  reservedQuantity: number;
  readyQuantity: number;
  discrepancyQuantity: number;
  notes?: string | null;
  createdAt: ISODateString;
  completedAt?: ISODateString | null;
  items?: PreparationItemDto[];
  reservation?: ReservationDto;
  dispatchOrder?: DispatchOrderDto;
}

export interface PreparationReadyItemDto {
  reservationItemId: UUID;
  readyQuantity: number;
  discrepancyQuantity?: number;
  discrepancyReason?: string;
}

export interface CreatePreparationDto {
  reservationId: UUID;
  items: PreparationReadyItemDto[];
  notes?: string;
}

export interface CustomsReleaseDto {
  id: UUID;
  dispatchOrderId: UUID;
  status: CustomsReleaseStatus;
  externalRef?: string | null;
  blockedReason?: string | null;
  notes?: string | null;
  createdAt: ISODateString;
  clearedAt?: ISODateString | null;
  dispatchOrder?: DispatchOrderDto;
}

export interface CreateCustomsReleaseDto {
  dispatchOrderId: UUID;
  externalRef?: string;
  notes?: string;
}

export interface ClearCustomsReleaseDto {
  externalRef?: string;
  notes?: string;
}

export interface BlockCustomsReleaseDto {
  blockedReason: string;
  notes?: string;
}

export interface TransportExitDto {
  id: UUID;
  dispatchOrderId: UUID;
  status: TransportExitStatus;
  externalRef?: string | null;
  docsReadyAt?: ISODateString | null;
  scaleWeightKg?: number | null;
  scaledAt?: ISODateString | null;
  authorizedAt?: ISODateString | null;
  dispatchedAt?: ISODateString | null;
  blockedReason?: string | null;
  notes?: string | null;
  createdAt: ISODateString;
  dispatchOrder?: DispatchOrderDto;
}

export interface CreateTransportExitDto {
  dispatchOrderId: UUID;
  externalRef?: string;
  notes?: string;
}

export interface MarkTransportDocsReadyDto {
  externalRef?: string;
  notes?: string;
}

export interface RecordTransportScaleDto {
  scaleWeightKg: number;
  externalRef?: string;
  notes?: string;
}

export interface BlockTransportExitDto {
  blockedReason: string;
  notes?: string;
}

export interface AuditEventDto {
  id: UUID;
  actor: string;
  source: AuditSource;
  action: AuditAction;
  entityType: string;
  entityId: UUID;
  entityCode?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: UUID | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  createdAt: ISODateString;
}

export interface AuditEventQueryDto {
  entityType: string;
  entityId: UUID;
}
