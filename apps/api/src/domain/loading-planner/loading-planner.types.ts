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
  loadingLayers?: PlannerLoadingLayerInput[];
  axleGroups?: PlannerAxleGroupInput[];
}

export interface PlannerLoadingLayerInput {
  number: number;
  label?: string;
  groupLabel?: string;
  minZMm: number;
  maxZMm: number;
}

export interface PlannerAxleGroupInput {
  code: string;
  label: string;
  startXMm: number;
  endXMm: number;
  maxWeightKg: number;
  source?: string;
  notes?: string;
}

export type AxleLoadStatusValue = 'OK' | 'EXCEEDED' | 'UNKNOWN';

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
  layerNumber?: number;
  layerLabel?: string;
  layerGroupLabel?: string;
  xMm: number;
  yMm: number;
  zMm: number;
  rotationDeg: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightKg: number;
  stackable?: boolean;
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

export interface PlannerLoadingLayer {
  number: number;
  label: string;
  groupLabel: string;
  minZMm: number;
  maxZMm: number;
}

export interface PlannerAxleLoadSnapshot {
  axleGroupCode: string;
  axleGroupLabel: string;
  source?: string;
  notes?: string;
  startXMm: number;
  endXMm: number;
  maxWeightKg: number;
  computedWeightKg: number;
  status: AxleLoadStatusValue;
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

export interface PlannerCandidateExplanation {
  summary: string;
  strengths: string[];
  tradeoffs: string[];
}

export interface PlannerCandidateSummary {
  index: number;
  name: string;
  score: number;
  hardViolationCount: number;
  placedItemCount: number;
  unplacedItemCount: number;
  explanation: PlannerCandidateExplanation;
}

export interface PlannerCandidateDetail extends PlannerCandidateSummary {
  placedItems: PlannerPlacedItem[];
  unplacedItems: PlannerUnplacedItem[];
  steps: PlannerStep[];
  alerts: PlannerAlert[];
  metrics: PlannerMetrics;
  evaluation: PlannerEvaluation;
  axleLoadSnapshots: PlannerAxleLoadSnapshot[];
}

export interface PlannerDiscardedCandidateSummary extends PlannerCandidateSummary {
  reason: string;
}

export interface PlannerCandidateDiagnostics {
  winnerIndex: number;
  winnerName: string;
  winnerExplanation: PlannerCandidateExplanation;
  candidates: PlannerCandidateDetail[];
  bestPartialCandidate?: PlannerCandidateDetail;
  discardedCandidates?: PlannerDiscardedCandidateSummary[];
}

export interface LoadingPlannerResult {
  loadingLayers: PlannerLoadingLayer[];
  placedItems: PlannerPlacedItem[];
  unplacedItems: PlannerUnplacedItem[];
  steps: PlannerStep[];
  alerts: PlannerAlert[];
  metrics: PlannerMetrics;
  evaluation: PlannerEvaluation;
  axleLoadSnapshots: PlannerAxleLoadSnapshot[];
  candidateDiagnostics?: PlannerCandidateDiagnostics;
}
