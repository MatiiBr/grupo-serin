import type { AlertSeverity, AlertType, LoadingMethod, ProductFamily, TruckZoneType, UnplacedReason } from '@prisma/client';

export type LoadingMethodValue = `${LoadingMethod}`;
export type ProductFamilyValue = `${ProductFamily}`;
export type TruckZoneTypeValue = `${TruckZoneType}`;
export type UnplacedReasonValue = `${UnplacedReason}`;
export type AlertSeverityValue = `${AlertSeverity}`;
export type AlertTypeValue = `${AlertType}`;

export interface PlannerTruckZoneInput {
  id: string;
  type: TruckZoneTypeValue;
  startXMm?: number;
  endXMm?: number;
  startYMm?: number;
  endYMm?: number;
  maxWeightKg?: number;
}

export interface PlannerTruckInput {
  id: string;
  loadingMethod: LoadingMethodValue;
  maxPayloadKg?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  zones: PlannerTruckZoneInput[];
}

export interface PlannerDestinationInput {
  id: string;
  name: string;
  unloadingOrder: number;
}

export interface PlannerProductInput {
  id: string;
  code: string;
  family: ProductFamilyValue;
  description?: string;
  destinationId?: string;
  quantity: number;
  weightKg?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  stackable: boolean;
  rotationAllowed: boolean;
}

export interface LoadingPlannerInput {
  truck: PlannerTruckInput;
  destinations: PlannerDestinationInput[];
  products: PlannerProductInput[];
}

export interface PlannerPlacedItem {
  productId: string;
  unitIndex: number;
  truckZoneId?: string;
  zoneType: TruckZoneTypeValue;
  xMm: number;
  yMm: number;
  zMm: number;
  rotationDeg: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightKg: number;
  sequence: number;
}

export interface PlannerUnplacedItem {
  productId: string;
  unitIndex: number;
  reason: UnplacedReasonValue;
  message: string;
}

export interface PlannerStep {
  sequence: number;
  productId: string;
  unitIndex: number;
  title: string;
  instructions: string;
}

export interface PlannerAlert {
  productId?: string;
  severity: AlertSeverityValue;
  type: AlertTypeValue;
  message: string;
}

export interface PlannerMetrics {
  totalWeightKg: number;
  placedWeightKg: number;
  unplacedWeightKg: number;
  usedVolumeM3: number;
  volumeUtilizationPct: number;
  placedItemCount: number;
  unplacedItemCount: number;
  leftWeightKg: number;
  rightWeightKg: number;
  cabinSideWeightKg: number;
  centerWeightKg: number;
  doorSideWeightKg: number;
  criticalAlertCount: number;
  warningAlertCount: number;
  loadLengthMm: number;
  maxHeightMm: number;
  centerOfGravityX?: number;
  centerOfGravityY?: number;
  centerOfGravityZ?: number;
}

export interface PlannerEvaluationPenalty {
  code: string;
  points: number;
  message: string;
}

export interface PlannerEvaluation {
  score: number;
  hardViolationCount: number;
  softPenaltyTotal: number;
  penalties: PlannerEvaluationPenalty[];
  alerts: PlannerAlert[];
}

export interface PlannerCandidateSummary {
  index: number;
  name: string;
  score: number;
  hardViolationCount: number;
  placedItemCount: number;
  unplacedItemCount: number;
}

export interface PlannerCandidateDetail extends PlannerCandidateSummary {
  placedItems: PlannerPlacedItem[];
  unplacedItems: PlannerUnplacedItem[];
  steps: PlannerStep[];
  alerts: PlannerAlert[];
  metrics: PlannerMetrics;
  evaluation: PlannerEvaluation;
}

export interface PlannerCandidateDiagnostics {
  winnerIndex: number;
  winnerName: string;
  candidates: PlannerCandidateDetail[];
}

export interface LoadingPlannerResult {
  placedItems: PlannerPlacedItem[];
  unplacedItems: PlannerUnplacedItem[];
  steps: PlannerStep[];
  alerts: PlannerAlert[];
  metrics: PlannerMetrics;
  evaluation: PlannerEvaluation;
  candidateDiagnostics?: PlannerCandidateDiagnostics;
}
