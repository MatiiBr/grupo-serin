import { PlanStatus, ProductFamily } from '@camiones/shared';
import { Canvas } from '@react-three/fiber';
import { Edges, OrbitControls, Text } from '@react-three/drei';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { loadingPlansApi } from '../../../api/loading-plans';
import { queryKeys } from '../../../api/queryKeys';
import type { AdjustPlacedItemPayload, LoadingPlan, LoadingPlanCandidateDetail, LoadingPlanCandidateDiagnostics, LoadingPlanEvaluation, PlacedItem, PlanAlert, PlaceUnplacedItemPayload, Truck, UnplacedItem } from '../../../api/types';
import { MutationError, SectionTitle } from '../../../components/ui';
import { DataTable, MetricGrid } from './operation-ui';

type ItemAlertStatus = 'critical' | 'warning' | undefined;

export interface PlacedItemAdjustmentFormValues {
  xCm: string;
  yCm: string;
  zCm: string;
  rotationDeg: string;
  locked?: boolean;
}

export interface UnplacedItemPlacementFormValues {
  xCm: string;
  yCm: string;
  zCm: string;
  rotationDeg: string;
  locked?: boolean;
}

export function PlanDetail({ plan, operationId, truck }: { plan: LoadingPlan; operationId: string; truck: Truck | null }) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(() => (plan.steps.length > 0 ? 1 : 0));
  const [viewAll, setViewAll] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<number | null>(null);
  const adjustItem = useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: Parameters<typeof loadingPlansApi.adjustPlacedItem>[2] }) =>
      loadingPlansApi.adjustPlacedItem(plan.id, itemId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.loadingPlan.current(operationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.detail(operationId) });
    },
  });
  const placeUnplacedItem = useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: PlaceUnplacedItemPayload }) =>
      loadingPlansApi.placeUnplacedItem(plan.id, itemId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.loadingPlan.current(operationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.detail(operationId) });
    },
  });
  const selectedCandidate = plan.candidateDiagnostics?.candidates.find((candidate) => candidate.index === selectedCandidateIndex) ?? null;
  const preview = selectedCandidate ? candidatePreview(selectedCandidate) : null;
  const displayedPlacedItems = preview?.placedItems ?? plan.placedItems;
  const displayedUnplacedItems = preview?.unplacedItems ?? plan.unplacedItems;
  const displayedSteps = preview?.steps ?? plan.steps;
  const displayedAlerts = preview?.alerts ?? plan.alerts;
  const displayedMetrics = preview?.metrics ?? plan.metrics;
  const displayedEvaluation = preview?.evaluation ?? plan.evaluation;
  const displayedAlertCounts = preview?.alertCounts ?? plan.alertCounts;
  const sequenceByPlacedItemId = useMemo(() => new Map(displayedSteps.filter((step) => step.placedItemId).map((step) => [step.placedItemId!, step.sequence])), [displayedSteps]);
  const maxStep = displayedSteps.length;
  const visibleItems = useMemo(() => {
    if (viewAll || maxStep === 0) return displayedPlacedItems;
    return displayedPlacedItems.filter((item) => {
      const sequence = sequenceByPlacedItemId.get(item.id);
      return sequence !== undefined && sequence <= currentStep;
    });
  }, [currentStep, displayedPlacedItems, maxStep, sequenceByPlacedItemId, viewAll]);
  const selectedItem = displayedPlacedItems.find((item) => item.id === selectedItemId) ?? visibleItems.at(-1) ?? null;
  const activeStep = displayedSteps.find((step) => step.sequence === currentStep) ?? null;
  const alertsByPlacedItemId = useMemo(() => buildAlertsByPlacedItemId(displayedAlerts), [displayedAlerts]);
  const itemStatusByPlacedItemId = useMemo(() => buildItemStatusByPlacedItemId(alertsByPlacedItemId), [alertsByPlacedItemId]);
  const selectedItemAlerts = selectedItem ? (alertsByPlacedItemId.get(selectedItem.id) ?? []) : [];
  const criticalAlerts = displayedAlerts.filter((alert) => alert.severity === 'CRITICAL');
  const placedItemLabelById = useMemo(() => new Map(displayedPlacedItems.map((item) => [item.id, `${item.productCode} #${item.unitIndex}`])), [displayedPlacedItems]);

  useEffect(() => {
    setCurrentStep(plan.steps.length > 0 ? 1 : 0);
    setViewAll(false);
    setSelectedItemId(null);
    setSelectedCandidateIndex(null);
  }, [plan.id, plan.steps.length]);

  useEffect(() => {
    setCurrentStep(displayedSteps.length > 0 ? 1 : 0);
    setViewAll(false);
    setSelectedItemId(null);
  }, [displayedSteps.length, selectedCandidateIndex]);

  return (
    <div className="stack">
      <section className="card">
        <SectionTitle title={`Plan v${plan.version}`} subtitle={`${planStatusLabel(plan.planStatus)} / ${loadingMethodLabel(plan.loadingMethod)} / ${plan.isCurrent ? 'actual' : 'historico'}`} />
        {selectedCandidate ? <p className="candidate-preview-copy">Previsualizando alternativa: <strong>{candidateNameLabel(selectedCandidate.name)}</strong>. El plan guardado sigue siendo {candidateNameLabel(plan.candidateDiagnostics?.winnerName ?? 'current')}.</p> : null}
        <MetricGrid metrics={displayedMetrics} />
        <PlanEvaluationPanel evaluation={displayedEvaluation ?? undefined} />
        <PlanCandidateDiagnosticsPanel diagnostics={plan.candidateDiagnostics} selectedCandidateIndex={selectedCandidateIndex} onSelectCandidate={setSelectedCandidateIndex} />
      </section>
      <section className="card simulation-card">
        <SectionTitle title="Simulacion 3D de carga" subtitle="Secuencia operativa con altura real y posicion Z" />
        {criticalAlerts.length > 0 ? <PlanCriticalBanner count={criticalAlerts.length} /> : null}
        <div className="simulation-layout">
          <PlannerScene items={visibleItems} selectedItemId={selectedItem?.id ?? null} sequenceByPlacedItemId={sequenceByPlacedItemId} itemStatusByPlacedItemId={itemStatusByPlacedItemId} truck={truck} onSelect={setSelectedItemId} />
          <div className="simulation-side">
            <StepControls currentStep={currentStep} maxStep={maxStep} viewAll={viewAll} onPrevious={() => setCurrentStep((step) => Math.max(1, step - 1))} onNext={() => setCurrentStep((step) => Math.min(maxStep, step + 1))} onReset={() => { setCurrentStep(maxStep > 0 ? 1 : 0); setViewAll(false); }} onToggleViewAll={() => setViewAll((value) => !value)} />
            <StepInstructionPanel step={activeStep} maxStep={maxStep} viewAll={viewAll} visibleCount={visibleItems.length} criticalCount={criticalAlerts.length} />
            <SelectedItemPanel item={selectedItem} sequence={selectedItem ? sequenceByPlacedItemId.get(selectedItem.id) : undefined} alerts={selectedItemAlerts} readOnly={Boolean(selectedCandidate) || plan.planStatus === PlanStatus.APPROVED} isSaving={adjustItem.isPending} error={adjustItem.error} onSave={(itemId, payload) => adjustItem.mutate({ itemId, payload })} />
          </div>
        </div>
      </section>
      <section className="grid two wide-left">
        <div className="card">
          <SectionTitle title="Vista superior" subtitle="Plano tecnico simplificado" />
          <TruckCanvas items={displayedPlacedItems} truck={truck} itemStatusByPlacedItemId={itemStatusByPlacedItemId} />
        </div>
        <div className="card">
          <PlanAlertsPanel alerts={displayedAlerts} alertCounts={displayedAlertCounts} placedItemLabelById={placedItemLabelById} />
        </div>
      </section>
      <section className="grid two">
        <DataTable title="Ubicados" headers={['Producto', 'Destino', 'X/Y/Z', 'L/A/H']} rows={displayedPlacedItems.map((item) => [item.productCode, item.destinationName ?? '-', `${formatPosition(item.xMm)} / ${formatPosition(item.yMm)} / ${formatPosition(item.zMm)}`, `${formatDimension(item.lengthMm)} × ${formatDimension(item.widthMm)} × ${formatDimension(item.heightMm)}`])} />
        <UnplacedItemsPanel items={displayedUnplacedItems} readOnly={Boolean(selectedCandidate) || plan.planStatus === PlanStatus.APPROVED} isSaving={placeUnplacedItem.isPending} error={placeUnplacedItem.error} onPlace={(itemId, payload) => placeUnplacedItem.mutate({ itemId, payload })} />
      </section>
    </div>
  );
}

export function PlanEvaluationPanel({ evaluation }: { evaluation?: LoadingPlanEvaluation | null }) {
  if (!evaluation) return null;

  const status = evaluation.hardViolationCount > 0 ? `${evaluation.hardViolationCount} violacion(es) criticas` : 'Sin violaciones criticas';

  return (
    <div className={`evaluation-panel${evaluation.hardViolationCount > 0 ? ' critical' : ''}`}>
      <div className="evaluation-score">
        <h3>Score de plan</h3>
        <strong>{evaluation.score}</strong>
        <small>{status}</small>
      </div>
      <div className="evaluation-penalties">
        <span>Penalizaciones</span>
        {evaluation.penalties.length === 0 ? <p className="muted">Sin penalizaciones blandas.</p> : evaluation.penalties.map((penalty) => (
          <div className="penalty-row" key={penalty.code}>
            <strong>{penaltyLabel(penalty.code)}</strong>
            <b>-{penalty.points} pts</b>
            <span>{penaltyMessage(penalty.code, penalty.message)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlanCandidateDiagnosticsPanel({ diagnostics, selectedCandidateIndex, onSelectCandidate }: { diagnostics?: LoadingPlanCandidateDiagnostics | null; selectedCandidateIndex?: number | null; onSelectCandidate?: (index: number | null) => void }) {
  if (!diagnostics) return null;

  const discardedCandidates = diagnostics.discardedCandidates ?? [];
  const bestPartialCandidate = diagnostics.bestPartialCandidate;
  const winner = diagnostics.candidates.find((candidate) => candidate.index === diagnostics.winnerIndex)
    ?? bestPartialCandidate
    ?? discardedCandidates.find((candidate) => candidate.index === diagnostics.winnerIndex);
  const activeIndex = selectedCandidateIndex ?? diagnostics.winnerIndex;

  return (
    <div className="candidate-diagnostics-panel">
      <div className="candidate-winner-card">
        <h3>Alternativas válidas</h3>
        <p>Elegí una alternativa válida para verla completa en el camión. Los intentos con reglas duras incumplidas quedan como diagnóstico, no como alternativa de carga.</p>
        <span>Elegida #{diagnostics.winnerIndex}</span>
        <strong>{candidateNameLabel(diagnostics.winnerName)}</strong>
        {winner ? <small>Puntaje {winner.score} / {winner.hardViolationCount} criticas</small> : null}
        <CandidateExplanation explanation={diagnostics.winnerExplanation} />
        {onSelectCandidate ? <button type="button" className={selectedCandidateIndex === null ? 'active' : ''} onClick={() => onSelectCandidate(null)}>Ver plan guardado</button> : null}
      </div>
      <div className="candidate-list" aria-label="Alternativas válidas">
        {diagnostics.candidates.length === 0 ? <p className="muted">No hay alternativas válidas completas para comparar. El plan guardado muestra el mejor resultado parcial encontrado.</p> : null}
        {diagnostics.candidates.length === 0 && bestPartialCandidate ? <BestPartialCandidateNotice candidate={bestPartialCandidate} /> : null}
        {diagnostics.candidates.map((candidate) => (
          <CandidateAlternativeButton key={`${candidate.index}-${candidate.name}`} candidate={candidate} isWinner={candidate.index === diagnostics.winnerIndex} isActive={candidate.index === activeIndex} onSelectCandidate={onSelectCandidate} />
        ))}
      </div>
      {discardedCandidates.length > 0 ? <DiscardedCandidateDiagnostics candidates={discardedCandidates} /> : null}
    </div>
  );
}

function BestPartialCandidateNotice({ candidate }: { candidate: LoadingPlanCandidateDetail }) {
  return (
    <div className="candidate-row partial">
      <div className="candidate-main">
        <h4>Plan base parcial para completar manualmente</h4>
        <span>{candidateNameLabel(candidate.name)} / intento #{candidate.index}</span>
      </div>
      <div className="candidate-stats" aria-label="Metricas del plan parcial">
        <strong>Puntaje {candidate.score}</strong>
        <span>{candidate.hardViolationCount} criticas</span>
        <span>{candidate.placedItemCount} ubicados</span>
        <span>{candidate.unplacedItemCount} sin ubicar</span>
      </div>
      <span className="candidate-summary">El plan guardado muestra este resultado parcial; completá los bultos sin ubicar desde la sección de pendientes.</span>
    </div>
  );
}

function CandidateAlternativeButton({ candidate, isWinner, isActive, onSelectCandidate }: { candidate: LoadingPlanCandidateDetail; isWinner: boolean; isActive: boolean; onSelectCandidate?: (index: number | null) => void }) {
  return (
    <button type="button" className={`candidate-row${isWinner ? ' winner' : ''}${isActive ? ' active' : ''}`} onClick={() => onSelectCandidate?.(candidate.index)}>
      <div className="candidate-main">
        <b>{candidateNameLabel(candidate.name)}</b>
        <span>Alternativa #{candidate.index}</span>
      </div>
      <div className="candidate-stats" aria-label="Metricas de alternativa">
        <strong>Puntaje {candidate.score}</strong>
        <span>{candidate.hardViolationCount} criticas</span>
        <span>{candidate.placedItemCount} ubicados</span>
        <span>{candidate.unplacedItemCount} sin ubicar</span>
      </div>
      {candidate.explanation ? <span className="candidate-summary">{candidate.explanation.summary}</span> : null}
    </button>
  );
}

function DiscardedCandidateDiagnostics({ candidates }: { candidates: NonNullable<LoadingPlanCandidateDiagnostics['discardedCandidates']> }) {
  return (
    <div className="candidate-discarded-list" aria-label="Intentos descartados">
      <h4>Intentos descartados</h4>
      <p className="muted">No son alternativas seleccionables porque incumplen reglas duras.</p>
      {candidates.map((candidate) => (
        <div className="candidate-row discarded" key={`${candidate.index}-${candidate.name}`}>
          <div className="candidate-main">
            <b>{candidateNameLabel(candidate.name)}</b>
            <span>Intento #{candidate.index}</span>
          </div>
          <div className="candidate-stats" aria-label="Metricas de intento descartado">
            <strong>Puntaje {candidate.score}</strong>
            <span>{candidate.hardViolationCount} criticas</span>
            <span>{candidate.placedItemCount} ubicados</span>
            <span>{candidate.unplacedItemCount} sin ubicar</span>
          </div>
          <span className="candidate-summary">{candidate.reason}</span>
        </div>
      ))}
    </div>
  );
}

function CandidateExplanation({ explanation }: { explanation?: LoadingPlanCandidateDiagnostics['winnerExplanation'] }) {
  if (!explanation) return null;

  return (
    <div className="candidate-explanation">
      <p>{explanation.summary}</p>
      {explanation.strengths.length > 0 ? <div><b>Motivos</b><ul>{explanation.strengths.map((strength) => <li key={strength}>{strength}</li>)}</ul></div> : null}
      {explanation.tradeoffs.length > 0 ? <div><b>Tradeoffs pendientes</b><ul>{explanation.tradeoffs.map((tradeoff) => <li key={tradeoff}>{tradeoff}</li>)}</ul></div> : null}
    </div>
  );
}

export function PlanAlertsPanel({ alerts, alertCounts, placedItemLabelById = new Map() }: { alerts: PlanAlert[]; alertCounts: LoadingPlan['alertCounts']; placedItemLabelById?: Map<string, string> }) {
  const criticalAlerts = alerts.filter((alert) => alert.severity === 'CRITICAL');

  return (
    <>
      <SectionTitle title="Alertas" subtitle={`${alertCounts.critical} criticas / ${alertCounts.warning} advertencias`} />
      {criticalAlerts.length > 0 ? <p className="approval-blocker">Plan con errores criticos: corregir antes de aprobar.</p> : null}
      {alerts.length === 0 ? <p className="muted">Sin alertas.</p> : <div className="list compact">{alerts.map((alert) => <div className={`alert ${alert.severity.toLowerCase()}`} key={alert.id}><strong>{alertTitle(alert, placedItemLabelById)}</strong><span>{alertMessage(alert)}</span></div>)}</div>}
    </>
  );
}

function alertTitle(alert: PlanAlert, placedItemLabelById: Map<string, string>) {
  const severity = alertSeverityLabel(alert.severity);
  const product = alertProductLabel(alert, placedItemLabelById);
  return product ? `${severity}: ${product}` : severity;
}

function penaltyLabel(code: string) {
  const labels: Record<string, string> = {
    'weight-imbalance': 'Desbalance de peso',
    'load-length': 'Largo ocupado',
    'unplaced-items': 'Bultos sin ubicar',
  };

  return labels[code] ?? code;
}

function penaltyMessage(code: string, fallback: string) {
  const messages: Record<string, string> = {
    'weight-imbalance': 'La distribucion izquierda/derecha quedo desbalanceada.',
    'load-length': 'El plan usa largo del camion; cuanto menos largo ocupado, mejor.',
    'unplaced-items': 'Hay bultos que no pudieron ubicarse automaticamente.',
  };

  return messages[code] ?? fallback;
}

export function candidateNameLabel(name: string) {
  const labels: Record<string, string> = {
    current: 'Base automática',
    base: 'Base automática',
    'light-first': 'Livianos primero',
    'large-footprint-first': 'Mayor huella primero',
    'volume-first': 'Mayor volumen primero',
    'target-zone': 'Agrupado por zona',
    'balance-lateral': 'Balance lateral',
    'long-first': 'Largos primero',
    'stack-friendly': 'Apilado seguro',
    'best-fit-compact': 'Compactación eficiente',
  };

  return labels[name] ?? name;
}

function planStatusLabel(status: string) {
  const labels: Record<string, string> = {
    GENERATED: 'Generado',
    MODIFIED: 'Modificado',
    APPROVED: 'Aprobado',
    INVALID: 'Invalido',
  };

  return labels[status] ?? status;
}

function loadingMethodLabel(method: string) {
  const labels: Record<string, string> = {
    REAR: 'Carga trasera',
    SIDE: 'Carga lateral',
    TOP: 'Carga superior',
    MIXED: 'Carga mixta',
  };

  return labels[method] ?? method;
}

function PlannerScene({ items, selectedItemId, sequenceByPlacedItemId, itemStatusByPlacedItemId, truck, onSelect }: { items: PlacedItem[]; selectedItemId: string | null; sequenceByPlacedItemId: Map<string, number>; itemStatusByPlacedItemId: Map<string, ItemAlertStatus>; truck: Truck | null; onSelect: (id: string) => void }) {
  const dimensions = useMemo(() => truckDimensions(items, truck), [items, truck]);
  const scale = 14 / Math.max(dimensions.lengthMm, dimensions.widthMm, dimensions.heightMm, 1);

  return (
    <div className="planner-scene">
      <Canvas camera={{ position: [7.5, 5.2, 8], fov: 36 }} shadows>
        <color attach="background" args={["#15120e"]} />
        <ambientLight intensity={0.72} />
        <directionalLight position={[6, 9, 5]} intensity={1.35} castShadow />
        <TruckFrame dimensions={dimensions} scale={scale} />
        {items.map((item) => (
          <PlacedItemBox key={item.id} item={item} sequence={sequenceByPlacedItemId.get(item.id)} alertStatus={itemStatusByPlacedItemId.get(item.id)} scale={scale} truckLengthMm={dimensions.lengthMm} truckWidthMm={dimensions.widthMm} selected={item.id === selectedItemId} onSelect={onSelect} />
        ))}
        <OrbitControls
          makeDefault
          enablePan
          enableDamping
          zoomToCursor
          panSpeed={0.85}
          zoomSpeed={0.85}
          minDistance={5}
          maxDistance={26}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, 1.2, 0]}
        />
      </Canvas>
      <div className="scene-hint">Orbitar / zoom / seleccionar bulto</div>
    </div>
  );
}

function TruckFrame({ dimensions, scale }: { dimensions: { lengthMm: number; widthMm: number; heightMm: number }; scale: number }) {
  const length = dimensions.lengthMm * scale;
  const width = dimensions.widthMm * scale;
  const height = dimensions.heightMm * scale;
  const zoneLength = length / 3;

  return (
    <group>
      <mesh receiveShadow position={[0, -0.015, 0]}>
        <boxGeometry args={[length, 0.03, width]} />
        <meshStandardMaterial color="#332b22" roughness={0.88} metalness={0.2} />
        <Edges color="#ffbf73" />
      </mesh>
      <mesh position={[0, height / 2, -width / 2]}><boxGeometry args={[length, height, 0.035]} /><meshBasicMaterial color="#ffbf73" transparent opacity={0.12} /></mesh>
      <mesh position={[0, height / 2, width / 2]}><boxGeometry args={[length, height, 0.035]} /><meshBasicMaterial color="#ffbf73" transparent opacity={0.12} /></mesh>
      <mesh position={[length / 2, height / 2, 0]}><boxGeometry args={[0.035, height, width]} /><meshBasicMaterial color="#ffbf73" transparent opacity={0.14} /></mesh>
      <gridHelper args={[Math.max(length, width), 12, '#6b5b47', '#2b241c']} position={[0, 0.01, 0]} />
      {[-length / 2 + zoneLength, -length / 2 + zoneLength * 2].map((x) => <mesh key={x} position={[x, 0.025, 0]}><boxGeometry args={[0.025, 0.05, width]} /><meshBasicMaterial color="#866a47" /></mesh>)}
      <mesh position={[-length / 2 - 0.18, height / 2, 0]}><boxGeometry args={[0.08, height, width]} /><meshBasicMaterial color="#77522d" transparent opacity={0.35} /></mesh>
      <Text position={[-length / 2 + 0.8, 0.08, -width / 2 - 0.35]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.22} color="#ffcf8f">CABINA</Text>
      <Text position={[length / 2 - 0.8, 0.08, width / 2 + 0.35]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.22} color="#ffcf8f">PUERTAS</Text>
    </group>
  );
}

function PlacedItemBox({ item, sequence, alertStatus, scale, truckLengthMm, truckWidthMm, selected, onSelect }: { item: PlacedItem; sequence?: number; alertStatus: ItemAlertStatus; scale: number; truckLengthMm: number; truckWidthMm: number; selected: boolean; onSelect: (id: string) => void }) {
  const length = item.lengthMm * scale;
  const width = item.widthMm * scale;
  const height = Math.max(item.heightMm * scale, 0.08);
  const x = (item.xMm + item.lengthMm / 2 - truckLengthMm / 2) * scale;
  const y = (item.zMm + item.heightMm / 2) * scale;
  const z = (item.yMm + item.widthMm / 2 - truckWidthMm / 2) * scale;
  const color = alertStatus === 'critical' ? '#ff1f1f' : alertStatus === 'warning' ? '#ffbf3f' : selected ? '#ffe08a' : item.manuallyAdjusted ? '#41d6c3' : familyColor(item.productFamily);
  const edgeColor = alertStatus === 'critical' ? '#ffffff' : item.locked ? '#ffffff' : selected ? '#ffffff' : '#2c1b0b';

  return (
    <group position={[x, y, z]} onClick={(event) => { event.stopPropagation(); onSelect(item.id); }}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[length, height, width]} />
        <meshStandardMaterial color={color} emissive={alertStatus === 'critical' ? '#7a0000' : '#000000'} roughness={0.58} metalness={0.28} />
        <Edges color={edgeColor} />
      </mesh>
      {alertStatus === 'critical' ? <Text position={[0, height / 2 + 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.24} color="#ffffff">INVALIDO</Text> : null}
      {alertStatus === 'warning' ? <Text position={[0, height / 2 + 0.32, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.2} color="#2b1700">ALERTA</Text> : null}
      {sequence ? <Text position={[0, height / 2 + 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={Math.max(0.18, Math.min(length, width) / 4)} color="#19110a">#{sequence}</Text> : null}
      {item.locked ? <Text position={[0, height / 2 + 0.34, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.18} color="#ffffff">LOCK</Text> : null}
    </group>
  );
}

function StepControls({ currentStep, maxStep, viewAll, onPrevious, onNext, onReset, onToggleViewAll }: { currentStep: number; maxStep: number; viewAll: boolean; onPrevious: () => void; onNext: () => void; onReset: () => void; onToggleViewAll: () => void }) {
  return (
    <div className="step-controls">
      <div><span>Paso</span><strong>{maxStep === 0 ? 'Sin secuencia' : `${currentStep}/${maxStep}`}</strong></div>
      <button type="button" onClick={onPrevious} disabled={viewAll || currentStep <= 1}>Anterior</button>
      <button type="button" onClick={onNext} disabled={viewAll || currentStep >= maxStep}>Siguiente</button>
      <button type="button" onClick={onReset}>Reset</button>
      <button type="button" className={viewAll ? 'active' : ''} onClick={onToggleViewAll}>Ver todo</button>
    </div>
  );
}

function StepInstructionPanel({ step, maxStep, viewAll, visibleCount, criticalCount }: { step: LoadingPlan['steps'][number] | null; maxStep: number; viewAll: boolean; visibleCount: number; criticalCount: number }) {
  if (maxStep === 0) return <div className="instruction-panel"><strong>Sin pasos del backend</strong><p>Se muestra la carga completa porque este plan no trae secuencia operativa.</p></div>;
  return <div className={`instruction-panel${criticalCount > 0 ? ' has-critical' : ''}`}><span>{viewAll ? 'Vista consolidada' : `Paso ${step?.sequence ?? '-'}`}</span><strong>{viewAll ? `${visibleCount} bultos ubicados` : stepTitle(step)}</strong>{criticalCount > 0 ? <p className="danger-copy">Plan invalido: hay {criticalCount} alerta(s) critica(s). No aprobar hasta corregirlas.</p> : null}<p>{viewAll ? 'Todos los bultos del plan estan visibles para auditoria.' : stepInstructions(step)}</p></div>;
}

export function PlanStepInstructionPreview({ step }: { step: LoadingPlan['steps'][number] }) {
  return <StepInstructionPanel step={step} maxStep={1} viewAll={false} visibleCount={1} criticalCount={0} />;
}

function SelectedItemPanel({ item, sequence, alerts, readOnly, isSaving, error, onSave }: { item: PlacedItem | null; sequence?: number; alerts: PlanAlert[]; readOnly: boolean; isSaving: boolean; error: Error | null; onSave: (itemId: string, payload: Parameters<typeof loadingPlansApi.adjustPlacedItem>[2]) => void }) {
  const { handleSubmit, register, reset } = useForm<PlacedItemAdjustmentFormValues>();

  useEffect(() => {
    if (!item) return;
    reset({
      xCm: millimetersToCentimetersInput(item.xMm),
      yCm: millimetersToCentimetersInput(item.yMm),
      zCm: millimetersToCentimetersInput(item.zMm),
      rotationDeg: item.rotationDeg.toString(),
      locked: item.locked,
    });
  }, [item, reset]);

  if (!item) return <div className="selected-panel"><strong>Seleccion de bulto</strong><p className="muted">Elegi un bloque en la escena 3D para ver posicion y dimensiones.</p></div>;
  const criticalAlerts = alerts.filter((alert) => alert.severity === 'CRITICAL');
  const warningAlerts = alerts.filter((alert) => alert.severity === 'WARNING');
  const onSubmit = handleSubmit((values) => onSave(item.id, buildPlacedItemAdjustmentPayload(values)));
  const rows = [
    ['Paso', sequence ? `#${sequence}` : '-'],
    ['Codigo', item.productCode],
    ['Nombre', productDisplayName(item.productName)],
    ['Familia', item.productFamily],
    ['Destino', item.destinationName ?? '-'],
    ['Posicion', `x ${formatPosition(item.xMm)} / y ${formatPosition(item.yMm)} / z ${formatPosition(item.zMm)}`],
    ['Dimensiones', `${formatDimension(item.lengthMm)} × ${formatDimension(item.widthMm)} × ${formatDimension(item.heightMm)}`],
    ['Rotacion', `${item.rotationDeg} deg`],
    ['Altura piso', item.zMm === 0 ? 'En piso (z=0)' : `Apilado z=${formatPosition(item.zMm)}`],
    ['Estado', `${item.manuallyAdjusted ? 'Manual' : 'Automatico'}${item.locked ? ' / bloqueado' : ''}`],
  ];
  return (
    <div className={`selected-panel${criticalAlerts.length > 0 ? ' invalid' : warningAlerts.length > 0 ? ' warning' : ''}`}>
      <strong>Bulto seleccionado</strong>
      {alerts.length > 0 ? <ItemAlertBox alerts={alerts} /> : null}
      {rows.map(([label, value]) => <div className="detail-row" key={label}><span>{label}</span><b>{value}</b></div>)}
      {readOnly ? <p className="approved-copy">Plan aprobado: no se permiten ajustes manuales.</p> : <form
        className="adjust-form"
        key={item.id}
        onSubmit={onSubmit}
      >
        <label>X cm<input type="number" min="0" step="0.1" required {...register('xCm', { required: true })} /></label>
        <label>Y cm<input type="number" min="0" step="0.1" required {...register('yCm', { required: true })} /></label>
        <label>Z cm<input type="number" min="0" step="0.1" required {...register('zCm', { required: true })} /></label>
        <label>Rotacion<input type="number" min="0" step="90" required {...register('rotationDeg', { required: true })} /></label>
        <label className="check wide"><input type="checkbox" {...register('locked')} /> Bloquear bulto</label>
        <button type="submit" disabled={isSaving}>{isSaving ? 'Guardando' : 'Guardar ajuste'}</button>
        <MutationError error={error} />
      </form>}
    </div>
  );
}

function UnplacedItemsPanel({ items, readOnly, isSaving, error, onPlace }: { items: UnplacedItem[]; readOnly: boolean; isSaving: boolean; error: Error | null; onPlace: (itemId: string, payload: PlaceUnplacedItemPayload) => void }) {
  return (
    <div className="card">
      <SectionTitle title="No ubicados" subtitle={items.length === 0 ? 'Todos los bultos fueron ubicados.' : 'Podés ubicar manualmente los pendientes.'} />
      {items.length === 0 ? <p className="muted">Sin bultos pendientes.</p> : <div className="list compact">{items.map((item) => <UnplacedItemPlacementCard key={item.id} item={item} readOnly={readOnly} isSaving={isSaving} onPlace={onPlace} />)}</div>}
      <MutationError error={error} />
    </div>
  );
}

function UnplacedItemPlacementCard({ item, readOnly, isSaving, onPlace }: { item: UnplacedItem; readOnly: boolean; isSaving: boolean; onPlace: (itemId: string, payload: PlaceUnplacedItemPayload) => void }) {
  const { handleSubmit, register } = useForm<UnplacedItemPlacementFormValues>({
    defaultValues: { xCm: '0', yCm: '0', zCm: '0', rotationDeg: '0', locked: true },
  });
  const onSubmit = handleSubmit((values) => onPlace(item.id, buildUnplacedItemPlacementPayload(values)));

  return (
    <div className="unplaced-card">
      <div>
        <strong>{item.productCode} · {productDisplayName(item.productName)}</strong>
        <span>{item.destinationName ?? 'Sin destino'} · {unplacedMessage(item.message)}</span>
      </div>
      {readOnly ? <p className="approved-copy">No se puede ubicar manualmente en esta vista.</p> : <form className="adjust-form" onSubmit={onSubmit}>
        <label>X cm<input type="number" min="0" step="0.1" required {...register('xCm', { required: true })} /></label>
        <label>Y cm<input type="number" min="0" step="0.1" required {...register('yCm', { required: true })} /></label>
        <label>Z cm<input type="number" min="0" step="0.1" required {...register('zCm', { required: true })} /></label>
        <label>Rotacion<input type="number" min="0" step="90" required {...register('rotationDeg', { required: true })} /></label>
        <label className="check wide"><input type="checkbox" {...register('locked')} /> Bloquear bulto</label>
        <button type="submit" disabled={isSaving}>{isSaving ? 'Ubicando' : 'Ubicar manualmente'}</button>
      </form>}
    </div>
  );
}

export function buildPlacedItemAdjustmentPayload(values: PlacedItemAdjustmentFormValues): AdjustPlacedItemPayload {
  return {
    xMm: centimetersToMillimeters(values.xCm),
    yMm: centimetersToMillimeters(values.yCm),
    zMm: centimetersToMillimeters(values.zCm),
    rotationDeg: requiredIntegerValue(values.rotationDeg),
    locked: Boolean(values.locked),
  };
}

export function buildUnplacedItemPlacementPayload(values: UnplacedItemPlacementFormValues): PlaceUnplacedItemPayload {
  return {
    xMm: centimetersToMillimeters(values.xCm),
    yMm: centimetersToMillimeters(values.yCm),
    zMm: centimetersToMillimeters(values.zCm),
    rotationDeg: requiredIntegerValue(values.rotationDeg),
    locked: Boolean(values.locked),
  };
}

export function formatPosition(valueMm: number) {
  return `${(valueMm / 1000).toFixed(2)} m`;
}

export function formatDimension(valueMm: number) {
  if (valueMm >= 1000) return `${(valueMm / 1000).toFixed(2)} m`;
  return `${Math.round(valueMm / 10)} cm`;
}

function candidatePreview(candidate: LoadingPlanCandidateDetail) {
  return {
    placedItems: candidate.placedItems,
    unplacedItems: candidate.unplacedItems,
    steps: candidate.steps,
    alerts: candidate.alerts,
    metrics: candidate.metrics,
    evaluation: candidate.evaluation,
    alertCounts: {
      critical: candidate.alerts.filter((alert) => alert.severity === 'CRITICAL').length,
      warning: candidate.alerts.filter((alert) => alert.severity === 'WARNING').length,
    },
  };
}

function requiredIntegerValue(value: string) {
  return Number.parseInt(value.trim(), 10);
}

function centimetersToMillimeters(value: string) {
  return Math.round(Number.parseFloat(value.trim()) * 10);
}

function millimetersToCentimetersInput(valueMm: number) {
  const valueCm = valueMm / 10;
  return Number.isInteger(valueCm) ? valueCm.toString() : valueCm.toFixed(1);
}

function PlanCriticalBanner({ count }: { count: number }) {
  return <div className="critical-banner"><strong>Plan invalido</strong><span>{count} alerta(s) critica(s). Se puede guardar el ajuste manual, pero no debe aprobarse hasta corregir fuera de camion o solapes.</span></div>;
}

function ItemAlertBox({ alerts }: { alerts: PlanAlert[] }) {
  const headline = itemAlertHeadline(alerts);
  return <div className={`item-alert-box ${alerts.some((alert) => alert.severity === 'CRITICAL') ? 'critical' : 'warning'}`}><strong>{headline}</strong>{alerts.map((alert) => <span key={alert.id}>{alertMessage(alert)}</span>)}</div>;
}

function truckDimensions(items: PlacedItem[], truck: Truck | null) {
  const usedLength = Math.max(1000, ...items.map((item) => item.xMm + item.lengthMm));
  const usedWidth = Math.max(1000, ...items.map((item) => item.yMm + item.widthMm));
  const usedHeight = Math.max(1000, ...items.map((item) => item.zMm + item.heightMm));
  return {
    lengthMm: truck?.lengthMm ?? usedLength,
    widthMm: truck?.widthMm ?? usedWidth,
    heightMm: truck?.heightMm ?? usedHeight,
  };
}

function familyColor(family: ProductFamily) {
  const colors: Record<ProductFamily, string> = {
    [ProductFamily.COIL]: '#8fb9a8',
    [ProductFamily.SHEET]: '#d95f2f',
    [ProductFamily.PROFILE]: '#ffb45f',
    [ProductFamily.TUBE]: '#8aa8d8',
    [ProductFamily.BAR]: '#d7c47a',
    [ProductFamily.GENERIC_PACKAGE]: '#c9b99f',
  };
  return colors[family] ?? '#ffb45f';
}

export function TruckCanvas({ items, truck, itemStatusByPlacedItemId }: { items: PlacedItem[]; truck: Truck | null; itemStatusByPlacedItemId: Map<string, ItemAlertStatus> }) {
  const bounds = useMemo(() => {
    const maxX = truck?.lengthMm ?? Math.max(1000, ...items.map((item) => item.xMm + item.lengthMm));
    const maxY = truck?.widthMm ?? Math.max(1000, ...items.map((item) => item.yMm + item.widthMm));
    return { maxX, maxY };
  }, [items, truck]);

  return (
    <div className="truck-map">
      <div className="axis cabin">Cabina</div>
      {items.map((item) => (
        <div
          className={`placed${item.manuallyAdjusted ? ' manual' : ''}${item.locked ? ' locked' : ''}${itemStatusByPlacedItemId.get(item.id) ? ` ${itemStatusByPlacedItemId.get(item.id)}` : ''}`}
          key={item.id}
          style={{
            left: `${(item.xMm / bounds.maxX) * 100}%`,
            top: `${(item.yMm / bounds.maxY) * 100}%`,
            width: `${Math.max(4, (item.lengthMm / bounds.maxX) * 100)}%`,
            height: `${Math.max(8, (item.widthMm / bounds.maxY) * 100)}%`,
          }}
          title={`${item.productCode} ${formatDimension(item.lengthMm)} × ${formatDimension(item.widthMm)}${item.locked ? ' bloqueado' : ''}`}
        >
          {item.productCode}
        </div>
      ))}
      <div className="axis doors">Puertas</div>
    </div>
  );
}

export function buildAlertsByPlacedItemId(alerts: PlanAlert[]) {
  const byPlacedItemId = new Map<string, PlanAlert[]>();
  for (const alert of alerts) {
    if (!alert.placedItemId) continue;
    const itemAlerts = byPlacedItemId.get(alert.placedItemId) ?? [];
    itemAlerts.push(alert);
    byPlacedItemId.set(alert.placedItemId, itemAlerts);
  }
  return byPlacedItemId;
}

export function buildItemStatusByPlacedItemId(alertsByPlacedItemId: Map<string, PlanAlert[]>) {
  const statuses = new Map<string, ItemAlertStatus>();
  for (const [placedItemId, alerts] of alertsByPlacedItemId) {
    if (alerts.some((alert) => alert.severity === 'CRITICAL')) statuses.set(placedItemId, 'critical');
    else if (alerts.some((alert) => alert.severity === 'WARNING')) statuses.set(placedItemId, 'warning');
  }
  return statuses;
}

function itemAlertHeadline(alerts: PlanAlert[]) {
  if (alerts.some((alert) => alert.type === 'OUT_OF_BOUNDS')) return 'Ubicacion invalida: fuera del camion';
  if (alerts.some((alert) => alert.type === 'OVERLAP')) return 'Ubicacion invalida: solapada con otro bulto';
  if (alerts.some((alert) => alert.severity === 'CRITICAL')) return 'Ubicacion invalida';
  return 'Advertencia del bulto';
}

function alertSeverityLabel(severity: string) {
  if (severity === 'CRITICAL') return 'Critica';
  if (severity === 'WARNING') return 'Advertencia';
  return 'Informativa';
}

function alertMessage(alert: PlanAlert) {
  if (alert.type === 'WEIGHT_IMBALANCE' && alert.message.startsWith('Lateral load differs')) {
    const match = alert.message.match(/left ([\d.]+)kg, right ([\d.]+)kg/i);
    if (match) return `El peso lateral difiere mas de 20%: izquierda ${formatKg(Number(match[1]))}, derecha ${formatKg(Number(match[2]))}.`;
  }

  if (alert.type === 'WEIGHT_IMBALANCE' && alert.message.startsWith('Zone load is concentrated')) return 'La carga quedo concentrada en un tercio del camion.';
  if (alert.type === 'MAX_WEIGHT_EXCEEDED' && alert.message.startsWith('Total load')) return 'La carga supera el limite permitido del camion o de una zona.';
  if (alert.type === 'MAX_WEIGHT_EXCEEDED' && alert.message.startsWith('Truck zone')) {
    const match = alert.message.match(/Truck zone ([A-Z_]+) load ([\d.]+)kg exceeds zone max ([\d.]+)kg/i);
    if (match) return `La ${zoneTypeLabel(match[1])} carga ${formatKg(Number(match[2]))} y supera el maximo de zona ${formatKg(Number(match[3]))}.`;
  }
  if (alert.type === 'UNPLACED_ITEM' && alert.message.startsWith('El producto')) {
    const unitMatch = alert.message.match(/unidad (\d+)/i);
    return `No pudimos ubicar${unitMatch ? ` la unidad ${unitMatch[1]}` : ' este bulto'}: ${unplacedMessage(alert.message)}.`;
  }
  if (alert.type === 'UNPLACED_ITEM' && alert.message.startsWith('Product')) return 'No pudimos ubicar este bulto automaticamente.';
  if (alert.type === 'UNPLACED_ITEM' && alert.message.startsWith('No floor space available')) return 'No hay espacio disponible en piso para este bulto.';

  return alert.message;
}

function alertProductLabel(alert: PlanAlert, placedItemLabelById = new Map<string, string>()) {
  const name = productDisplayName(alert.productName);
  if (alert.productCode && name && name !== alert.productCode) return `${alert.productCode} · ${name}`;
  if (alert.productCode) return alert.productCode;
  if (name) return name;
  if (alert.placedItemId) return placedItemLabelById.get(alert.placedItemId) ?? 'Bulto';
  return 'Bulto';
}

function productDisplayName(name?: string | null) {
  if (!name) return '';
  return name.split('|')[0].trim();
}

function unplacedMessage(message: string) {
  if (message.includes('No floor space available')) return 'no hay espacio disponible en piso ni en zonas alternativas';
  if (message.includes('No stack support available')) return 'no hay apoyo seguro para apilar';
  if (message.startsWith('Product') || message.startsWith('El producto')) return 'no pudo ubicarse automaticamente';
  return message;
}

function formatKg(value: number) {
  return `${value.toFixed(1)} kg`;
}

function stepTitle(step: LoadingPlan['steps'][number] | null) {
  if (!step) return 'Paso no encontrado';
  const match = step.title.match(/^Load unit (\d+)$/i);
  if (match) return `Cargar unidad ${match[1]}`;
  return step.title;
}

function stepInstructions(step: LoadingPlan['steps'][number] | null) {
  if (!step?.instructions) return 'Sin instruccion registrada.';

  const match = step.instructions.match(/^Place product .+ in ([A-Z_]+) at x=(\d+)mm, y=(\d+)mm\.$/i);
  if (match) return `Ubicar el bulto en ${zoneTypeLabel(match[1])}: x=${formatPosition(Number(match[2]))}, y=${formatPosition(Number(match[3]))}.`;

  return step.instructions;
}

function zoneTypeLabel(zoneType: string) {
  const labels: Record<string, string> = {
    CABIN_SIDE: 'zona cabina',
    CENTER: 'zona central',
    DOOR_SIDE: 'zona puerta',
  };

  return labels[zoneType] ?? zoneType;
}
