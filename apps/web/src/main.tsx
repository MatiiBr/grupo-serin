import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlanStatus, ProductFamily } from '@camiones/shared';
import { Canvas } from '@react-three/fiber';
import { Edges, Environment, Lightformer, OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { type ReactElement, StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { destinationsApi } from './api/destinations';
import { LifecyclePage, OrdersPage, DispatchPage } from './features/lifecycle/LifecyclePage';
import { loadingPlansApi } from './api/loading-plans';
import { operationsApi } from './api/operations';
import { productsApi } from './api/products';
import { trucksApi } from './api/trucks';
import type { LoadingPlan, OperationDestinationAssignment, OperationDetail, OperationProductAssignment, OperationSummary, OperationVehicleAssignment, PlacedItem, PlanAlert, Truck } from './api/types';
import { EmptyState, MutationError, QueryState, SectionTitle } from './components/ui';
import { optionalDate, optionalInteger, optionalNumber, optionalText, requiredInteger, requiredText } from './lib/forms';
import { formatAssignmentWeight, formatDate, formatNumber, formatProductDimensions } from './lib/formatters';
import { navigate } from './lib/navigation';
import './styles.css';

const queryClient = new QueryClient();

type RouteName = 'lifecycle' | 'orders' | 'dispatch' | 'operations' | 'operation' | 'truck' | 'destinations' | 'products' | 'planner' | 'report' | 'not-found';

interface Route {
  name: RouteName;
  operationId?: string;
}

function parseRoute(pathname: string): Route {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'operations' };
  if (parts[0] === 'lifecycle') return { name: 'lifecycle' };
  if (parts[0] === 'orders') return { name: 'orders' };
  if (parts[0] === 'dispatch') return { name: 'dispatch' };
  if (parts[0] !== 'operations') return { name: 'not-found' };
  if (parts.length === 1) return { name: 'operations' };
  const operationId = parts[1];
  if (parts.length === 2) return { name: 'operation', operationId };
  if (parts[2] === 'truck') return { name: 'truck', operationId };
  if (parts[2] === 'destinations') return { name: 'destinations', operationId };
  if (parts[2] === 'products') return { name: 'products', operationId };
  if (parts[2] === 'planner') return { name: 'planner', operationId };
  if (parts[2] === 'report') return { name: 'report', operationId };
  return { name: 'not-found' };
}

function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return route;
}

function App() {
  const route = useRoute();

  return (
    <div className="shell">
      <header className="masthead">
        <button className="brand" type="button" onClick={() => navigate('/operations')}>
          <span>Camiones</span>
          <strong>Stowage Control</strong>
        </button>
        <nav className="top-nav" aria-label="Flujo logistico">
          <button className={route.name === 'operations' ? 'active' : ''} type="button" onClick={() => navigate('/operations')}>Carga</button>
          <button className={route.name === 'lifecycle' ? 'active' : ''} type="button" onClick={() => navigate('/lifecycle')}>Lifecycle</button>
          <button className={route.name === 'orders' ? 'active' : ''} type="button" onClick={() => navigate('/orders')}>Pedidos</button>
          <button className={route.name === 'dispatch' ? 'active' : ''} type="button" onClick={() => navigate('/dispatch')}>Dispatch</button>
        </nav>
        <div className="status-strip">Acerera / Pedido / Dispatch / Carga</div>
      </header>

      {route.name === 'lifecycle' && <LifecyclePage />}
      {route.name === 'orders' && <OrdersPage />}
      {route.name === 'dispatch' && <DispatchPage />}
      {route.name === 'operations' && <OperationsPage />}
      {route.name === 'operation' && route.operationId && <OperationPage operationId={route.operationId} />}
      {route.name === 'truck' && route.operationId && <TruckPage operationId={route.operationId} />}
      {route.name === 'destinations' && route.operationId && <DestinationsPage operationId={route.operationId} />}
      {route.name === 'products' && route.operationId && <ProductsPage operationId={route.operationId} />}
      {route.name === 'planner' && route.operationId && <PlannerPage operationId={route.operationId} />}
      {route.name === 'report' && route.operationId && <ReportPage operationId={route.operationId} />}
      {route.name === 'not-found' && <EmptyState title="Ruta no encontrada" text="Volver al tablero de operaciones." />}
    </div>
  );
}

function OperationsPage() {
  const queryClient = useQueryClient();
  const operations = useQuery({ queryKey: ['operations'], queryFn: operationsApi.list });
  const createOperation = useMutation({
    mutationFn: operationsApi.create,
    onSuccess: (operation) => {
      void queryClient.invalidateQueries({ queryKey: ['operations'] });
      navigate(`/operations/${operation.id}`);
    },
  });

  return (
    <main className="grid two">
      <section className="card hero-card">
        <p className="eyebrow">Milestone 1</p>
        <h1>Planificador tecnico de cargas</h1>
        <p className="lede">Operaciones, camion, destinos, productos y generacion de plan en un flujo minimo usable.</p>
      </section>
      <section className="card">
        <h2>Nueva operacion</h2>
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            createOperation.mutate({
              code: optionalText(form, 'code'),
              name: optionalText(form, 'name'),
              notes: optionalText(form, 'notes'),
              scheduledAt: optionalDate(form, 'scheduledAt'),
            });
          }}
        >
          <label>Codigo<input name="code" placeholder="OP-2026-001" /></label>
          <label>Nombre<input name="name" placeholder="Carga obra norte" /></label>
          <label>Programada<input name="scheduledAt" type="datetime-local" /></label>
          <label>Notas<textarea name="notes" rows={3} /></label>
          <button disabled={createOperation.isPending}>Crear operacion</button>
          <MutationError error={createOperation.error} />
        </form>
      </section>
      <section className="card span">
        <SectionTitle title="Operaciones" subtitle="Listado de cargas en preparacion" />
        <QueryState query={operations}>
          {(items) => (
            <div className="list">
              {items.map((operation) => (
                <OperationRow key={operation.id} operation={operation} />
              ))}
            </div>
          )}
        </QueryState>
      </section>
    </main>
  );
}

function OperationPage({ operationId }: { operationId: string }) {
  const operation = useOperation(operationId);
  return (
    <main>
      <QueryState query={operation}>
        {(item) => (
          <div className="stack">
            <OperationHeader operation={item} />
              <section className="grid four">
                <DashboardLink href={`/operations/${operationId}/truck`} label="Camion" value={item.vehicleAssignment?.truck?.plate ?? item.truck?.plate ?? 'Sin definir'} />
                <DashboardLink href={`/operations/${operationId}/destinations`} label="Destinos" value={String(item.destinationAssignments?.length ?? item.destinations.length)} />
                <DashboardLink href={`/operations/${operationId}/products`} label="Productos" value={String(item.productAssignments?.length ?? item.products.length)} />
                <DashboardLink href={`/operations/${operationId}/planner`} label="Plan" value={item.latestPlan ? `v${item.latestPlan.version}` : 'Pendiente'} />
              </section>
              {item.latestPlan ? <DashboardLink href={`/operations/${operationId}/report`} label="Reporte operativo" value={item.latestPlan.status} /> : null}
            {item.latestPlan && (
              <section className="card">
                <SectionTitle title="Ultimo plan" subtitle={`${item.latestPlan.status} / ${item.latestPlan.method}`} />
                <MetricGrid metrics={item.latestPlan.metrics} />
              </section>
            )}
          </div>
        )}
      </QueryState>
    </main>
  );
}

function TruckPage({ operationId }: { operationId: string }) {
  const queryClient = useQueryClient();
  const operation = useOperation(operationId);
  const trucks = useQuery({ queryKey: ['truck-catalog'], queryFn: () => trucksApi.searchCatalog() });
  const trailers = useQuery({ queryKey: ['trailer-catalog'], queryFn: () => trucksApi.searchTrailers() });
  const vehicle = useQuery({ queryKey: ['vehicle-assignment', operationId], queryFn: () => trucksApi.getAssignment(operationId) });
  const saveVehicle = useMutation({
    mutationFn: trucksApi.upsertAssignment.bind(null, operationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vehicle-assignment', operationId] });
      void queryClient.invalidateQueries({ queryKey: ['operation', operationId] });
    },
  });

  return (
    <main className="stack">
      <QueryState query={operation}>{(item) => <OperationHeader operation={item} />}</QueryState>
      <section className="card">
        <SectionTitle title="Vehiculo asignado" subtitle="Seleccion desde catalogo reutilizable de flota" />
        <QueryState query={trucks}>
          {(truckItems) => (
            <QueryState query={trailers}>
              {(trailerItems) => (
                <QueryState query={vehicle}>
                  {(item) => (
            <form
              className="form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                saveVehicle.mutate({
                  truckCatalogId: requiredText(form, 'truckCatalogId'),
                  trailerCatalogId: optionalText(form, 'trailerCatalogId') ?? null,
                  notes: optionalText(form, 'notes'),
                });
              }}
            >
              <label>Camion de catalogo<select name="truckCatalogId" defaultValue={item?.truckCatalogId ?? ''} required><option value="">Seleccionar camion</option>{truckItems.map((truck) => <option key={truck.id} value={truck.id}>{truck.plate} / {truck.loadingMethod} / {truck.lengthMm ?? '-'}x{truck.widthMm ?? '-'} mm</option>)}</select></label>
              <label>Acoplado<select name="trailerCatalogId" defaultValue={item?.trailerCatalogId ?? ''}><option value="">Sin acoplado</option>{trailerItems.map((trailer) => <option key={trailer.id} value={trailer.id}>{trailer.code} / {trailer.lengthMm ?? '-'}x{trailer.widthMm ?? '-'} mm</option>)}</select></label>
              <label>Notas operativas<textarea name="notes" rows={3} defaultValue={item?.notes ?? ''} /></label>
              <button disabled={saveVehicle.isPending || truckItems.length === 0}>{saveVehicle.isPending ? 'Asignando' : 'Asignar vehiculo'}</button>
              <MutationError error={saveVehicle.error} />
              {item ? <VehicleAssignmentSummary item={item} /> : <p className="muted">Sin vehiculo asignado a esta operacion.</p>}
            </form>
                  )}
                </QueryState>
              )}
            </QueryState>
          )}
        </QueryState>
      </section>
    </main>
  );
}

function DestinationsPage({ operationId }: { operationId: string }) {
  const queryClient = useQueryClient();
  const operation = useOperation(operationId);
  const catalog = useQuery({ queryKey: ['destination-catalog'], queryFn: () => destinationsApi.searchCatalog() });
  const destinations = useQuery({ queryKey: ['destination-assignments', operationId], queryFn: () => destinationsApi.listAssignments(operationId) });
  const createDestination = useMutation({
    mutationFn: (payload: Omit<Parameters<typeof destinationsApi.createAssignment>[1], 'unloadingOrder'>) =>
      destinationsApi.createAssignment(operationId, { ...payload, unloadingOrder: nextDestinationOrder(destinations.data ?? []) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['destination-assignments', operationId] });
      void queryClient.invalidateQueries({ queryKey: ['operation', operationId] });
    },
  });
  const reorderDestinations = useMutation({
    mutationFn: (ids: string[]) => destinationsApi.reorderAssignments(operationId, ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['destination-assignments', operationId] });
      void queryClient.invalidateQueries({ queryKey: ['operation', operationId] });
    },
  });
  const deleteDestination = useDeleteMutation((id: string) => destinationsApi.removeAssignment(id), ['destination-assignments', operationId], ['operation', operationId]);

  return (
    <main className="stack">
      <QueryState query={operation}>{(item) => <OperationHeader operation={item} />}</QueryState>
      <section className="grid two">
        <div className="card">
          <SectionTitle title="Asignar destino" subtitle="Catalogo reutilizable; la secuencia se asigna automaticamente" />
          <QueryState query={catalog}>
            {(items) => <form className="form" onSubmit={(event) => handleDestinationAssignmentSubmit(event, createDestination.mutate)}>
            <label>Destino de catalogo<select name="destinationCatalogId" required><option value="">Seleccionar destino</option>{items.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}{destination.code ? ` / ${destination.code}` : ''}</option>)}</select></label>
            <label>Notas de operacion<textarea name="notes" rows={3} /></label>
            <button disabled={createDestination.isPending || items.length === 0}>Asignar destino</button>
            <MutationError error={createDestination.error} />
          </form>}
          </QueryState>
        </div>
        <div className="card">
          <SectionTitle title="Destinos" subtitle="Secuencia operativa continua" />
          <QueryState query={destinations}>
            {(items) => <DestinationList items={items} onDelete={(id) => deleteDestination.mutate(id)} onMove={(ids) => reorderDestinations.mutate(ids)} isReordering={reorderDestinations.isPending} />}
          </QueryState>
          <MutationError error={deleteDestination.error} />
          <MutationError error={reorderDestinations.error} />
        </div>
      </section>
    </main>
  );
}

function ProductsPage({ operationId }: { operationId: string }) {
  const queryClient = useQueryClient();
  const operation = useOperation(operationId);
  const destinations = useQuery({ queryKey: ['destination-assignments', operationId], queryFn: () => destinationsApi.listAssignments(operationId) });
  const catalog = useQuery({ queryKey: ['product-catalog'], queryFn: () => productsApi.searchCatalog() });
  const products = useQuery({ queryKey: ['product-assignments', operationId], queryFn: () => productsApi.listAssignments(operationId) });
  const createProduct = useMutation({
    mutationFn: productsApi.createAssignment.bind(null, operationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['product-assignments', operationId] });
      void queryClient.invalidateQueries({ queryKey: ['operation', operationId] });
    },
  });
  const deleteProduct = useDeleteMutation((id: string) => productsApi.removeAssignment(id), ['product-assignments', operationId], ['operation', operationId]);

  return (
    <main className="stack">
      <QueryState query={operation}>{(item) => <OperationHeader operation={item} />}</QueryState>
      <section className="grid two">
        <div className="card">
          <SectionTitle title="Asignar producto" subtitle="Catalogo reusable + cantidad y destino de esta operacion" />
          <QueryState query={destinations}>
            {(destinationItems) => (
              <QueryState query={catalog}>
                {(catalogItems) => <form className="form matrix" onSubmit={(event) => handleProductAssignmentSubmit(event, createProduct.mutate)}>
                <label className="wide">Producto de catalogo<select name="productCatalogId" required><option value="">Seleccionar producto</option>{catalogItems.map((product) => <option key={product.id} value={product.id}>{product.code} / {product.family} / {formatProductDimensions(product)}</option>)}</select></label>
                <label>Destino<select name="operationDestinationId"><option value="">Sin destino</option>{destinationItems.map((destination) => <option key={destination.id} value={destination.id}>#{destination.unloadingOrder} {destination.catalog?.name ?? destination.destinationCatalogId}</option>)}</select></label>
                <label>Cantidad<input name="quantity" type="number" min="1" defaultValue="1" /></label>
                <label>Peso override kg<input name="weightKgOverride" type="number" step="0.01" /></label>
                <label>Largo override mm<input name="lengthMmOverride" type="number" /></label>
                <label>Ancho override mm<input name="widthMmOverride" type="number" /></label>
                <label>Alto override mm<input name="heightMmOverride" type="number" /></label>
                <label className="check"><input name="stackableOverride" type="checkbox" /> Forzar apilable</label>
                <label className="check"><input name="rotationAllowedOverride" type="checkbox" /> Forzar rotacion</label>
                <label className="wide">Notas operativas<textarea name="notes" rows={3} /></label>
                <button disabled={createProduct.isPending || catalogItems.length === 0}>Asignar producto</button>
                <MutationError error={createProduct.error} />
              </form>}
              </QueryState>
            )}
          </QueryState>
        </div>
        <div className="card">
          <SectionTitle title="Productos" subtitle="Asignaciones de la operacion" />
          <QueryState query={products}>
            {(items) => <ProductAssignmentList items={items} onDelete={(id) => deleteProduct.mutate(id)} />}
          </QueryState>
          <MutationError error={deleteProduct.error} />
        </div>
      </section>
    </main>
  );
}

function PlannerPage({ operationId }: { operationId: string }) {
  const queryClient = useQueryClient();
  const operation = useOperation(operationId);
  const currentPlan = useQuery({ queryKey: ['loading-plan', operationId], queryFn: () => loadingPlansApi.current(operationId) });
  const generatePlan = useMutation({
    mutationFn: () => loadingPlansApi.generate(operationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['loading-plan', operationId] });
      void queryClient.invalidateQueries({ queryKey: ['operation', operationId] });
    },
  });
  const approvePlan = useMutation({
    mutationFn: (planId: string) => loadingPlansApi.approve(planId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['loading-plan', operationId] });
      void queryClient.invalidateQueries({ queryKey: ['operation', operationId] });
    },
  });
  const plan = generatePlan.data ?? currentPlan.data;
  const criticalCount = plan?.alertCounts.critical ?? 0;
  const isApproved = plan?.planStatus === PlanStatus.APPROVED;

  return (
    <main className="stack">
      <QueryState query={operation}>{(item) => <OperationHeader operation={item} />}</QueryState>
      <section className="card action-bar">
        <div>
          <h2>Planner</h2>
          <p>Genera el plan actual con validaciones de peso, volumen, zonas y no ubicados.</p>
        </div>
        <div className="actions">
          {plan ? <button className="ghost" type="button" onClick={() => navigate(`/operations/${operationId}/report`)}>Ver reporte</button> : null}
          {plan ? <button type="button" disabled={approvePlan.isPending || criticalCount > 0 || isApproved} onClick={() => approvePlan.mutate(plan.id)}>{isApproved ? 'Plan aprobado' : approvePlan.isPending ? 'Aprobando' : 'Aprobar plan'}</button> : null}
          <button disabled={generatePlan.isPending || isApproved} onClick={() => generatePlan.mutate()}>{isApproved ? 'Plan aprobado' : 'Generar plan'}</button>
        </div>
      </section>
      <MutationError error={generatePlan.error} />
      <MutationError error={approvePlan.error} />
      {plan && criticalCount > 0 ? <p className="approval-blocker">Aprobacion bloqueada: el plan tiene {criticalCount} alerta(s) critica(s).</p> : null}
      {isApproved ? <p className="approved-copy">Plan aprobado. Los ajustes manuales quedan en modo lectura.</p> : null}
      {currentPlan.isLoading && !plan ? <EmptyState title="Cargando plan" text="Buscando plan vigente." /> : null}
      {currentPlan.error && !plan ? <EmptyState title="Sin plan vigente" text="Genera un plan cuando camion y productos esten cargados." /> : null}
      {plan && <PlanDetail plan={plan} operationId={operationId} truck={operation.data?.truck ?? null} />}
    </main>
  );
}

function PlanDetail({ plan, operationId, truck }: { plan: LoadingPlan; operationId: string; truck: Truck | null }) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(() => (plan.steps.length > 0 ? 1 : 0));
  const [viewAll, setViewAll] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const adjustItem = useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: Parameters<typeof loadingPlansApi.adjustPlacedItem>[2] }) =>
      loadingPlansApi.adjustPlacedItem(plan.id, itemId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['loading-plan', operationId] });
      void queryClient.invalidateQueries({ queryKey: ['operation', operationId] });
    },
  });
  const sequenceByPlacedItemId = useMemo(() => new Map(plan.steps.filter((step) => step.placedItemId).map((step) => [step.placedItemId!, step.sequence])), [plan.steps]);
  const maxStep = plan.steps.length;
  const visibleItems = useMemo(() => {
    if (viewAll || maxStep === 0) return plan.placedItems;
    return plan.placedItems.filter((item) => {
      const sequence = sequenceByPlacedItemId.get(item.id);
      return sequence !== undefined && sequence <= currentStep;
    });
  }, [currentStep, maxStep, plan.placedItems, sequenceByPlacedItemId, viewAll]);
  const selectedItem = plan.placedItems.find((item) => item.id === selectedItemId) ?? visibleItems.at(-1) ?? null;
  const activeStep = plan.steps.find((step) => step.sequence === currentStep) ?? null;
  const alertsByPlacedItemId = useMemo(() => buildAlertsByPlacedItemId(plan.alerts), [plan.alerts]);
  const itemStatusByPlacedItemId = useMemo(() => buildItemStatusByPlacedItemId(alertsByPlacedItemId), [alertsByPlacedItemId]);
  const selectedItemAlerts = selectedItem ? (alertsByPlacedItemId.get(selectedItem.id) ?? []) : [];
  const criticalAlerts = plan.alerts.filter((alert) => alert.severity === 'CRITICAL');
  const placedItemLabelById = useMemo(() => new Map(plan.placedItems.map((item) => [item.id, `${item.productCode} #${item.unitIndex}`])), [plan.placedItems]);

  useEffect(() => {
    setCurrentStep(plan.steps.length > 0 ? 1 : 0);
    setViewAll(false);
    setSelectedItemId(null);
  }, [plan.id, plan.steps.length]);

  return (
    <div className="stack">
      <section className="card">
        <SectionTitle title={`Plan v${plan.version}`} subtitle={`${plan.planStatus} / ${plan.loadingMethod} / ${plan.isCurrent ? 'actual' : 'historico'}`} />
        <MetricGrid metrics={plan.metrics} />
      </section>
      <section className="card simulation-card">
        <SectionTitle title="Simulacion 3D de carga" subtitle="Secuencia operativa con altura real y posicion Z" />
        {criticalAlerts.length > 0 ? <PlanCriticalBanner count={criticalAlerts.length} /> : null}
        <div className="simulation-layout">
          <PlannerScene items={visibleItems} selectedItemId={selectedItem?.id ?? null} sequenceByPlacedItemId={sequenceByPlacedItemId} itemStatusByPlacedItemId={itemStatusByPlacedItemId} truck={truck} onSelect={setSelectedItemId} />
          <div className="simulation-side">
            <StepControls currentStep={currentStep} maxStep={maxStep} viewAll={viewAll} onPrevious={() => setCurrentStep((step) => Math.max(1, step - 1))} onNext={() => setCurrentStep((step) => Math.min(maxStep, step + 1))} onReset={() => { setCurrentStep(maxStep > 0 ? 1 : 0); setViewAll(false); }} onToggleViewAll={() => setViewAll((value) => !value)} />
            <StepInstructionPanel step={activeStep} maxStep={maxStep} viewAll={viewAll} visibleCount={visibleItems.length} criticalCount={criticalAlerts.length} />
            <SelectedItemPanel item={selectedItem} sequence={selectedItem ? sequenceByPlacedItemId.get(selectedItem.id) : undefined} alerts={selectedItemAlerts} readOnly={plan.planStatus === PlanStatus.APPROVED} isSaving={adjustItem.isPending} error={adjustItem.error} onSave={(itemId, payload) => adjustItem.mutate({ itemId, payload })} />
          </div>
        </div>
      </section>
      <section className="grid two wide-left">
        <div className="card">
          <SectionTitle title="Vista superior" subtitle="Plano tecnico simplificado" />
          <TruckCanvas items={plan.placedItems} truck={truck} itemStatusByPlacedItemId={itemStatusByPlacedItemId} />
        </div>
        <div className="card">
          <SectionTitle title="Alertas" subtitle={`${plan.alertCounts.critical} criticas / ${plan.alertCounts.warning} warnings`} />
          {criticalAlerts.length > 0 ? <p className="approval-blocker">Plan con errores criticos: corregir antes de aprobar.</p> : null}
          {plan.alerts.length === 0 ? <p className="muted">Sin alertas.</p> : <div className="list compact">{plan.alerts.map((alert) => <div className={`alert ${alert.severity.toLowerCase()}`} key={alert.id}><strong>{alert.severity}{alert.placedItemId ? ` / ${placedItemLabelById.get(alert.placedItemId) ?? 'bulto'}` : ''}</strong><span>{alert.message}</span></div>)}</div>}
        </div>
      </section>
      <section className="grid two">
        <DataTable title="Ubicados" headers={['Producto', 'Destino', 'X/Y/Z', 'L/A/H']} rows={plan.placedItems.map((item) => [item.productCode, item.destinationName ?? '-', `${item.xMm}/${item.yMm}/${item.zMm}`, `${item.lengthMm}/${item.widthMm}/${item.heightMm}`])} />
        <DataTable title="No ubicados" headers={['Producto', 'Destino', 'Motivo']} rows={plan.unplacedItems.map((item) => [item.productCode, item.destinationName ?? '-', item.message])} />
      </section>
    </div>
  );
}

function ReportPage({ operationId }: { operationId: string }) {
  const currentPlan = useQuery({ queryKey: ['loading-plan', operationId], queryFn: () => loadingPlansApi.current(operationId) });
  const planId = currentPlan.data?.id;
  const report = useQuery({
    queryKey: ['loading-plan-report', planId],
    queryFn: () => loadingPlansApi.report(planId!),
    enabled: Boolean(planId),
  });

  return (
    <main className="report-shell">
      <QueryState query={currentPlan}>
        {(plan) => {
          if (!plan) return <EmptyState title="Sin plan vigente" text="Genera un plan antes de imprimir el reporte operativo." />;
          return (
            <QueryState query={report}>
              {(item) => <OperationalReport report={item} />}
            </QueryState>
          );
        }}
      </QueryState>
    </main>
  );
}

function OperationalReport({ report }: { report: Awaited<ReturnType<typeof loadingPlansApi.report>> }) {
  const { operation, truck, destinations, products, plan } = report;
  const nonCriticalAlerts = plan.alerts.filter((alert) => alert.severity !== 'CRITICAL');
  const approvalDate = plan.approvedAt ?? (plan.planStatus === PlanStatus.APPROVED ? plan.updatedAt : null);
  const productRows = products.map((product) => [product.code, product.destinationName ?? '-', product.family, String(product.quantity), formatNumber(product.weightKg, 'kg')]);
  const stepRows = plan.steps.map((step) => [String(step.sequence), step.title, step.instructions ?? '-']);
  const placedRows = plan.placedItems.map((item) => [item.productCode, item.destinationName ?? '-', `${item.xMm}/${item.yMm}/${item.zMm}`, `${item.lengthMm}/${item.widthMm}/${item.heightMm}`, item.zoneType ?? '-']);

  return (
    <article className="print-report">
      <div className="report-actions no-print">
        <button className="ghost" type="button" onClick={() => navigate(`/operations/${operation.id}/planner`)}>Volver al planner</button>
        <button type="button" onClick={() => window.print()}>Imprimir reporte</button>
      </div>
      <header className="report-header">
        <div>
          <p className="eyebrow">Reporte operativo de carga</p>
          <h1>{operation.code}</h1>
          <p>{operation.name ?? 'Operacion sin nombre'}{operation.scheduledAt ? ` / ${formatDate(operation.scheduledAt)}` : ''}</p>
        </div>
        <div className="report-stamp">
          <span>{plan.planStatus}</span>
          <strong>{approvalDate ? formatDate(approvalDate) : 'Pendiente de aprobacion'}</strong>
        </div>
      </header>
      <section className="report-grid">
        <ReportBlock title="Camion" rows={[
          ['Patente', truck?.plate ?? '-'],
          ['Metodo', truck?.loadingMethod ?? plan.loadingMethod],
          ['Payload', formatNumber(truck?.maxPayloadKg, 'kg')],
          ['Dimensiones', truck ? `${truck.lengthMm ?? '-'} x ${truck.widthMm ?? '-'} x ${truck.heightMm ?? '-'} mm` : '-'],
        ]} />
        <ReportBlock title="Metricas" rows={[
          ['Peso total', formatNumber(plan.metrics?.totalWeightKg, 'kg')],
          ['Peso ubicado', formatNumber(plan.metrics?.placedWeightKg, 'kg')],
          ['Volumen usado', formatNumber(plan.metrics?.usedVolumeM3, 'm3')],
          ['Utilizacion', formatNumber(plan.metrics?.volumeUtilizationPct, '%')],
          ['Centro gravedad', `${formatNumber(plan.metrics?.centerOfGravityX, 'mm')} / ${formatNumber(plan.metrics?.centerOfGravityY, 'mm')} / ${formatNumber(plan.metrics?.centerOfGravityZ, 'mm')}`],
        ]} />
      </section>
      <section className="report-section">
        <h2>Destinos y orden de descarga</h2>
        <ReportTable headers={['Orden', 'Destino', 'Codigo', 'Direccion']} rows={destinations.map((destination) => [String(destination.unloadingOrder), destination.name, destination.code ?? '-', destination.address ?? '-'])} />
      </section>
      <section className="report-section">
        <h2>Resumen de productos</h2>
        <ReportTable headers={['Producto', 'Destino', 'Familia', 'Cantidad', 'Peso unitario']} rows={productRows} />
      </section>
      <section className="report-section">
        <h2>Secuencia de carga</h2>
        <ReportTable headers={['Paso', 'Accion', 'Instruccion']} rows={stepRows} />
      </section>
      <section className="report-section">
        <h2>Plano superior simplificado</h2>
        <TruckCanvas items={plan.placedItems} truck={truck} itemStatusByPlacedItemId={buildItemStatusByPlacedItemId(buildAlertsByPlacedItemId(plan.alerts))} />
        <ReportTable headers={['Producto', 'Destino', 'X/Y/Z', 'L/A/H', 'Zona']} rows={placedRows} />
      </section>
      <section className="report-section">
        <h2>Alertas no criticas</h2>
        {nonCriticalAlerts.length === 0 ? <p>Sin alertas no criticas.</p> : <ReportTable headers={['Severidad', 'Tipo', 'Mensaje']} rows={nonCriticalAlerts.map((alert) => [alert.severity, alert.type, alert.message])} />}
      </section>
      {operation.notes ? <section className="report-section"><h2>Notas</h2><p>{operation.notes}</p></section> : null}
    </article>
  );
}

function ReportBlock({ title, rows }: { title: string; rows: string[][] }) {
  return <section className="report-block"><h2>{title}</h2>{rows.map(([label, value]) => <div className="report-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>;
}

function ReportTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return <div className="report-table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

type ItemAlertStatus = 'critical' | 'warning' | undefined;

function PlannerScene({ items, selectedItemId, sequenceByPlacedItemId, itemStatusByPlacedItemId, truck, onSelect }: { items: PlacedItem[]; selectedItemId: string | null; sequenceByPlacedItemId: Map<string, number>; itemStatusByPlacedItemId: Map<string, ItemAlertStatus>; truck: Truck | null; onSelect: (id: string) => void }) {
  const dimensions = useMemo(() => truckDimensions(items, truck), [items, truck]);
  const scale = 14 / Math.max(dimensions.lengthMm, dimensions.widthMm, dimensions.heightMm, 1);

  return (
    <div className="planner-scene">
      <Canvas camera={{ position: [7.5, 5.2, 8], fov: 36 }} shadows>
        <color attach="background" args={["#15120e"]} />
        <ambientLight intensity={0.42} />
        <hemisphereLight color="#fff4e2" groundColor="#2a2218" intensity={0.55} />
        <directionalLight position={[6, 9, 5]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
        <directionalLight position={[-7, 5, -4]} intensity={0.5} color="#cfe0ff" />
        <directionalLight position={[0, 5, -9]} intensity={0.7} color="#ffcf9a" />
        {/* studio environment gives the steel real reflections (no external asset) */}
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={2.4} position={[0, 6, 3]} scale={[12, 6, 1]} color="#fff3e0" />
          <Lightformer form="rect" intensity={1.1} position={[-7, 3, -4]} scale={[7, 7, 1]} color="#cfe0ff" />
          <Lightformer form="rect" intensity={0.9} position={[7, 2, -3]} scale={[7, 7, 1]} color="#ffd9a8" />
        </Environment>
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
  const edgeColor = alertStatus === 'critical' ? '#ffffff' : item.locked ? '#ffffff' : selected ? '#ffffff' : '#20262e';
  // Steel-mill cargo: each family gets a recognizable shape.
  const isPackage = item.productFamily === ProductFamily.GENERIC_PACKAGE;
  const roughness = isPackage ? 0.82 : 0.3;
  const metalness = isPackage ? 0.12 : 0.9;
  const emissive = alertStatus === 'critical' ? '#7a0000' : '#000000';
  const mat = <meshStandardMaterial color={color} emissive={emissive} roughness={roughness} metalness={metalness} />;
  const seed = (item.id.charCodeAt(0) * 97 + item.id.charCodeAt(item.id.length - 1) * 131 + item.lengthMm) % 1000;

  let cargo: ReactElement;
  if (item.productFamily === ProductFamily.COIL) {
    // wire coil standing up (eye to the sky), with a hole
    const outerR = Math.min(length, width) / 2;
    const tube = Math.max(0.05, outerR * 0.4);
    const major = Math.max(0.06, outerR - tube);
    cargo = (
      <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[major, tube, 18, 34]} />
        {mat}
      </mesh>
    );
  } else if (item.productFamily === ProductFamily.TUBE) {
    // a bundle of round pipes of MIXED diameters (as shipped per dispatch)
    const cols = 4;
    const rows = 2;
    const cellW = width / cols;
    const cellH = height / rows;
    const cellR = Math.min(cellW, cellH) / 2;
    const pipes = [];
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        const pr = Math.max(0.028, cellR * (0.5 + 0.46 * pseudoRandom(seed + c * 7.1 + r * 3.3)));
        const jy = (pseudoRandom(seed + c * 3.1 + r * 11.7 + 5) - 0.5) * cellH * 0.45;
        const jz = (pseudoRandom(seed + c * 8.3 + r * 2.7 + 61) - 0.5) * cellW * 0.45;
        pipes.push(
          <mesh key={`${c}-${r}`} castShadow receiveShadow position={[0, -height / 2 + (r + 0.5) * cellH + jy, -width / 2 + (c + 0.5) * cellW + jz]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[pr, pr, length, 16]} />
            <meshStandardMaterial color={color} emissive={emissive} roughness={roughness} metalness={metalness} />
          </mesh>,
        );
      }
    }
    cargo = <group>{pipes}</group>;
  } else if (item.productFamily === ProductFamily.SHEET) {
    // a stack of thin steel plates
    const layers = 4;
    const gap = height / layers;
    const plates = [];
    for (let i = 0; i < layers; i += 1) {
      plates.push(
        <mesh key={i} castShadow receiveShadow position={[0, -height / 2 + gap * (i + 0.5), 0]}>
          <boxGeometry args={[length, gap * 0.68, width]} />
          <meshStandardMaterial color={color} emissive={emissive} roughness={roughness} metalness={metalness} />
          <Edges color={edgeColor} />
        </mesh>,
      );
    }
    cargo = <group>{plates}</group>;
  } else if (item.productFamily === ProductFamily.SQUARE_TUBE) {
    // a bundle of square-section tubes of MIXED sizes
    const cols = 4;
    const rows = 2;
    const cellW = width / cols;
    const cellH = height / rows;
    const tubes = [];
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        const v = pseudoRandom(seed + c * 5.7 + r * 9.1);
        const sw = cellW * (0.6 + 0.34 * v);
        const sh = cellH * (0.6 + 0.34 * v);
        const jy = (pseudoRandom(seed + c * 4.9 + r * 7.3 + 12) - 0.5) * cellH * 0.35;
        const jz = (pseudoRandom(seed + c * 2.1 + r * 6.6 + 70) - 0.5) * cellW * 0.35;
        tubes.push(
          <mesh key={`${c}-${r}`} castShadow receiveShadow position={[0, -height / 2 + (r + 0.5) * cellH + jy, -width / 2 + (c + 0.5) * cellW + jz]}>
            <boxGeometry args={[length, sh, sw]} />
            <meshStandardMaterial color={color} emissive={emissive} roughness={roughness} metalness={metalness} />
            <Edges color={edgeColor} />
          </mesh>,
        );
      }
    }
    cargo = <group>{tubes}</group>;
  } else if (item.productFamily === ProductFamily.REBAR) {
    // an irregular bundle of construction rebar — bends and deforms, no fixed shape
    const cols = 5;
    const rows = 2;
    const cellW = width / cols;
    const cellH = height / rows;
    const cellR = Math.min(cellW, cellH) / 2;
    const rods = [];
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        const v1 = pseudoRandom(seed + c * 2.3 + r * 8.7);
        const v2 = pseudoRandom(seed + c * 6.1 + r * 1.9 + 41);
        const v3 = pseudoRandom(seed + c * 4.4 + r * 5.5 + 93);
        const pz = -width / 2 + (c + 0.5) * cellW;
        const py = -height / 2 + (r + 0.5) * cellH;
        const rr = Math.max(0.015, cellR * (0.42 + 0.4 * v3));
        const sag = 0.05 + 0.2 * v1;
        const wob = (v2 - 0.5) * cellW * 0.8;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-length / 2, py, pz),
          new THREE.Vector3(-length * 0.18, py - sag * 0.65, pz + wob * 0.4),
          new THREE.Vector3(length * 0.12, py - sag, pz + wob),
          new THREE.Vector3(length / 2, py - sag * 0.25, pz + wob * 0.25),
        ]);
        rods.push(
          <mesh key={`${c}-${r}`} castShadow receiveShadow>
            <tubeGeometry args={[curve, 24, rr, 6, false]} />
            <meshStandardMaterial color={color} emissive={emissive} roughness={0.62} metalness={0.6} />
          </mesh>,
        );
      }
    }
    cargo = <group>{rods}</group>;
  } else if (item.productFamily === ProductFamily.ANGLE) {
    // L-shaped angle profile
    const t = Math.max(0.02, Math.min(width, height) * 0.24);
    cargo = (
      <group>
        <mesh castShadow receiveShadow position={[0, -height / 2 + t / 2, 0]}>
          <boxGeometry args={[length, t, width]} />
          <meshStandardMaterial color={color} emissive={emissive} roughness={roughness} metalness={metalness} />
          <Edges color={edgeColor} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0, -width / 2 + t / 2]}>
          <boxGeometry args={[length, height, t]} />
          <meshStandardMaterial color={color} emissive={emissive} roughness={roughness} metalness={metalness} />
          <Edges color={edgeColor} />
        </mesh>
      </group>
    );
  } else if (item.productFamily === ProductFamily.MESH) {
    // welded mesh panel: a grid of thin bars
    const bar = Math.max(0.014, Math.min(length, width) * 0.014);
    const nx = 6;
    const nz = 4;
    const grid = [];
    for (let i = 0; i <= nx; i += 1) {
      grid.push(
        <mesh key={`x${i}`} castShadow receiveShadow position={[-length / 2 + (i / nx) * length, 0, 0]}>
          <boxGeometry args={[bar, bar, width]} />
          <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
        </mesh>,
      );
    }
    for (let j = 0; j <= nz; j += 1) {
      grid.push(
        <mesh key={`z${j}`} castShadow receiveShadow position={[0, 0, -width / 2 + (j / nz) * width]}>
          <boxGeometry args={[length, bar, bar]} />
          <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
        </mesh>,
      );
    }
    cargo = <group>{grid}</group>;
  } else {
    // profiles, bars, packages: metallic beam / slab
    cargo = (
      <mesh castShadow receiveShadow>
        <boxGeometry args={[length, height, width]} />
        {mat}
        <Edges color={edgeColor} />
      </mesh>
    );
  }

  return (
    <group position={[x, y, z]} onClick={(event) => { event.stopPropagation(); onSelect(item.id); }}>
      {cargo}
      {alertStatus === 'critical' ? <Text position={[0, height / 2 + 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.24} color="#ffffff">INVALIDO</Text> : null}
      {alertStatus === 'warning' ? <Text position={[0, height / 2 + 0.32, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.2} color="#2b1700">WARNING</Text> : null}
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
  return <div className={`instruction-panel${criticalCount > 0 ? ' has-critical' : ''}`}><span>{viewAll ? 'Vista consolidada' : `Paso ${step?.sequence ?? '-'}`}</span><strong>{viewAll ? `${visibleCount} bultos ubicados` : (step?.title ?? 'Paso no encontrado')}</strong>{criticalCount > 0 ? <p className="danger-copy">Plan invalido: hay {criticalCount} alerta(s) critica(s). No aprobar hasta corregirlas.</p> : null}<p>{viewAll ? 'Todos los bultos del plan estan visibles para auditoria.' : (step?.instructions ?? 'Sin instruccion registrada.')}</p></div>;
}

function SelectedItemPanel({ item, sequence, alerts, readOnly, isSaving, error, onSave }: { item: PlacedItem | null; sequence?: number; alerts: PlanAlert[]; readOnly: boolean; isSaving: boolean; error: Error | null; onSave: (itemId: string, payload: Parameters<typeof loadingPlansApi.adjustPlacedItem>[2]) => void }) {
  if (!item) return <div className="selected-panel"><strong>Seleccion de bulto</strong><p className="muted">Elegi un bloque en la escena 3D para ver posicion y dimensiones.</p></div>;
  const criticalAlerts = alerts.filter((alert) => alert.severity === 'CRITICAL');
  const warningAlerts = alerts.filter((alert) => alert.severity === 'WARNING');
  const rows = [
    ['Paso', sequence ? `#${sequence}` : '-'],
    ['Codigo', item.productCode],
    ['Nombre', item.productName],
    ['Familia', item.productFamily],
    ['Destino', item.destinationName ?? '-'],
    ['Posicion', `x ${item.xMm} / y ${item.yMm} / z ${item.zMm} mm`],
    ['Dimensiones', `${item.lengthMm} x ${item.widthMm} x ${item.heightMm} mm`],
    ['Rotacion', `${item.rotationDeg} deg`],
    ['Altura piso', item.zMm === 0 ? 'En piso (z=0)' : `Apilado z=${item.zMm} mm`],
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
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          onSave(item.id, {
            xMm: requiredInteger(form, 'xMm'),
            yMm: requiredInteger(form, 'yMm'),
            zMm: requiredInteger(form, 'zMm'),
            rotationDeg: requiredInteger(form, 'rotationDeg'),
            locked: form.get('locked') === 'on',
          });
        }}
      >
        <label>X mm<input name="xMm" type="number" min="0" defaultValue={item.xMm} required /></label>
        <label>Y mm<input name="yMm" type="number" min="0" defaultValue={item.yMm} required /></label>
        <label>Z mm<input name="zMm" type="number" min="0" defaultValue={item.zMm} required /></label>
        <label>Rotacion<input name="rotationDeg" type="number" min="0" step="90" defaultValue={item.rotationDeg} required /></label>
        <label className="check wide"><input name="locked" type="checkbox" defaultChecked={item.locked} /> Bloquear bulto</label>
        <button type="submit" disabled={isSaving}>{isSaving ? 'Guardando' : 'Guardar ajuste'}</button>
        <MutationError error={error} />
      </form>}
    </div>
  );
}

function PlanCriticalBanner({ count }: { count: number }) {
  return <div className="critical-banner"><strong>Plan invalido</strong><span>{count} alerta(s) critica(s). Se puede guardar el ajuste manual, pero no debe aprobarse hasta corregir fuera de camion o solapes.</span></div>;
}

function ItemAlertBox({ alerts }: { alerts: PlanAlert[] }) {
  const headline = itemAlertHeadline(alerts);
  return <div className={`item-alert-box ${alerts.some((alert) => alert.severity === 'CRITICAL') ? 'critical' : 'warning'}`}><strong>{headline}</strong>{alerts.map((alert) => <span key={alert.id}>{alert.message}</span>)}</div>;
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

// deterministic per-item pseudo-random (stable across renders, so bundles don't flicker)
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function familyColor(family: ProductFamily) {
  const colors: Record<ProductFamily, string> = {
    [ProductFamily.COIL]: '#cbab63',
    [ProductFamily.SHEET]: '#a7bcd4',
    [ProductFamily.PROFILE]: '#828a97',
    [ProductFamily.TUBE]: '#98b6d6',
    [ProductFamily.BAR]: '#b7c0cb',
    [ProductFamily.REBAR]: '#a5764f',
    [ProductFamily.SQUARE_TUBE]: '#8f9aa6',
    [ProductFamily.ANGLE]: '#a6adb7',
    [ProductFamily.MESH]: '#c3cad2',
    [ProductFamily.GENERIC_PACKAGE]: '#b5894e',
  };
  return colors[family] ?? '#ffb45f';
}

function TruckCanvas({ items, truck, itemStatusByPlacedItemId }: { items: PlacedItem[]; truck: Truck | null; itemStatusByPlacedItemId: Map<string, ItemAlertStatus> }) {
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
          title={`${item.productCode} ${item.lengthMm}x${item.widthMm}${item.locked ? ' bloqueado' : ''}`}
        >
          {item.productCode}
        </div>
      ))}
      <div className="axis doors">Puertas</div>
    </div>
  );
}

function buildAlertsByPlacedItemId(alerts: PlanAlert[]) {
  const byPlacedItemId = new Map<string, PlanAlert[]>();
  for (const alert of alerts) {
    if (!alert.placedItemId) continue;
    const itemAlerts = byPlacedItemId.get(alert.placedItemId) ?? [];
    itemAlerts.push(alert);
    byPlacedItemId.set(alert.placedItemId, itemAlerts);
  }
  return byPlacedItemId;
}

function buildItemStatusByPlacedItemId(alertsByPlacedItemId: Map<string, PlanAlert[]>) {
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

function OperationHeader({ operation }: { operation: OperationDetail }) {
  const currentRoute = parseRoute(window.location.pathname).name;
  const basePath = `/operations/${operation.id}`;
  const links = [
    ['operation', 'Resumen', basePath],
    ['truck', 'Camion', `${basePath}/truck`],
    ['destinations', 'Destinos', `${basePath}/destinations`],
    ['products', 'Productos', `${basePath}/products`],
    ['planner', 'Planner', `${basePath}/planner`],
    ['report', 'Reporte', `${basePath}/report`],
  ] as const;

  return (
    <section className="card operation-head">
      <div className="operation-head-top">
        <button className="back" type="button" onClick={() => navigate('/operations')}>← Operaciones</button>
        <nav className="operation-nav" aria-label="Navegacion de operacion">
          {links.map(([routeName, label, href]) => (
            <button className={currentRoute === routeName ? 'active' : ''} key={routeName} type="button" onClick={() => navigate(href)}>
              {label}
            </button>
          ))}
        </nav>
      </div>
      <div className="operation-title-block">
        <p className="eyebrow">{operation.status}</p>
        <h1>{operation.code}</h1>
        <p className="lede">{operation.name ?? 'Operacion sin nombre'}{operation.scheduledAt ? ` / ${formatDate(operation.scheduledAt)}` : ''}</p>
      </div>
    </section>
  );
}

function OperationRow({ operation }: { operation: OperationSummary }) {
  return (
    <button className="row" type="button" onClick={() => navigate(`/operations/${operation.id}`)}>
      <span><strong>{operation.code}</strong><small>{operation.name ?? 'Sin nombre'} / {operation.status}</small></span>
      <span className="chips"><i>{operation.counts?.destinations ?? 0} destinos</i><i>{operation.counts?.products ?? 0} productos</i><i>{operation.counts?.plans ?? 0} planes</i></span>
    </button>
  );
}

function DashboardLink({ href, label, value }: { href: string; label: string; value: string }) {
  return <button className="dash" type="button" onClick={() => navigate(href)}><span>{label}</span><strong>{value}</strong></button>;
}

function VehicleAssignmentSummary({ item }: { item: OperationVehicleAssignment }) {
  return (
    <div className="assignment-summary">
      <strong>{item.truck?.plate ?? item.truckCatalogId}</strong>
      <span>{item.truck?.loadingMethod ?? '-'} / {item.truck?.lengthMm ?? '-'} x {item.truck?.widthMm ?? '-'} x {item.truck?.heightMm ?? '-'} mm</span>
      {item.trailer ? <span>Acoplado: {item.trailer.code}</span> : <span>Sin acoplado asignado</span>}
    </div>
  );
}

function DestinationList({ items, onDelete, onMove, isReordering }: { items: OperationDestinationAssignment[]; onDelete: (id: string) => void; onMove: (ids: string[]) => void; isReordering: boolean }) {
  if (items.length === 0) return <p className="muted">Sin destinos cargados.</p>;
  const sortedItems = [...items].sort((left, right) => left.unloadingOrder - right.unloadingOrder);
  return <div className="list compact sequence-list">{sortedItems.map((item, index) => <div className="item sequence-item" key={item.id}><span className="sequence-badge">{index + 1}</span><span><strong>{item.catalog?.name ?? item.destinationCatalogId}</strong><small>{item.catalog?.code ?? 'Sin codigo'} {item.catalog?.address ? `/ ${item.catalog.address}` : ''}{item.notes ? ` / ${item.notes}` : ''}</small></span><span className="sequence-actions"><button className="ghost" disabled={isReordering || index === 0} onClick={() => onMove(moveDestination(sortedItems, index, -1))}>Subir</button><button className="ghost" disabled={isReordering || index === sortedItems.length - 1} onClick={() => onMove(moveDestination(sortedItems, index, 1))}>Bajar</button><button className="ghost" onClick={() => onDelete(item.id)}>Eliminar</button></span></div>)}</div>;
}

function ProductAssignmentList({ items, onDelete }: { items: OperationProductAssignment[]; onDelete: (id: string) => void }) {
  if (items.length === 0) return <p className="muted">Sin productos cargados.</p>;
  return <div className="list compact">{items.map((item) => {
    const product = item.catalog;
    const destination = item.operationDestination?.catalog;
    return <div className="item" key={item.id}><span><strong>{product?.code ?? item.productCatalogId}</strong><small>{product?.family ?? '-'} / qty {item.quantity} / destino {destination?.name ?? 'sin destino'} / {formatAssignmentWeight(item, product)} / {formatProductDimensions(product)}</small></span><button className="ghost" onClick={() => onDelete(item.id)}>Eliminar</button></div>;
  })}</div>;
}

function MetricGrid({ metrics }: { metrics: LoadingPlan['metrics'] }) {
  const values = [
    ['Peso total', formatNumber(metrics?.totalWeightKg, 'kg')],
    ['Peso ubicado', formatNumber(metrics?.placedWeightKg, 'kg')],
    ['Volumen usado', formatNumber(metrics?.usedVolumeM3, 'm3')],
    ['Utilizacion', formatNumber(metrics?.volumeUtilizationPct, '%')],
    ['Ubicados', String(metrics?.placedItemCount ?? 0)],
    ['No ubicados', String(metrics?.unplacedItemCount ?? 0)],
  ];
  return <div className="metrics">{values.map(([label, value]) => <div className="metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;
}

function DataTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return <div className="card"><SectionTitle title={title} subtitle={`${rows.length} registros`} /><div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${title}-${index}`}>{row.map((cell, cellIndex) => <td key={`${title}-${index}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table></div></div>;
}

function useOperation(operationId: string) {
  return useQuery({ queryKey: ['operation', operationId], queryFn: () => operationsApi.get(operationId) });
}

function useDeleteMutation<T>(mutationFn: (id: string) => Promise<T>, ...queryKeys: unknown[][]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryKeys.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey }));
    },
  });
}

function handleDestinationAssignmentSubmit(event: React.FormEvent<HTMLFormElement>, submit: (payload: Omit<Parameters<typeof destinationsApi.createAssignment>[1], 'unloadingOrder'>) => void) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  submit({
    destinationCatalogId: requiredText(form, 'destinationCatalogId'),
    notes: optionalText(form, 'notes'),
  });
  event.currentTarget.reset();
}

function nextDestinationOrder(items: OperationDestinationAssignment[]) {
  if (items.length === 0) return 1;
  return Math.max(...items.map((item) => item.unloadingOrder)) + 1;
}

function moveDestination(items: OperationDestinationAssignment[], index: number, direction: -1 | 1) {
  const nextItems = [...items];
  const targetIndex = index + direction;
  [nextItems[index], nextItems[targetIndex]] = [nextItems[targetIndex], nextItems[index]];
  return nextItems.map((item) => item.id);
}

function handleProductAssignmentSubmit(event: React.FormEvent<HTMLFormElement>, submit: (payload: Parameters<typeof productsApi.createAssignment>[1]) => void) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  submit({
    productCatalogId: requiredText(form, 'productCatalogId'),
    operationDestinationId: optionalText(form, 'operationDestinationId') ?? null,
    quantity: optionalInteger(form, 'quantity'),
    weightKgOverride: optionalNumber(form, 'weightKgOverride'),
    lengthMmOverride: optionalInteger(form, 'lengthMmOverride'),
    widthMmOverride: optionalInteger(form, 'widthMmOverride'),
    heightMmOverride: optionalInteger(form, 'heightMmOverride'),
    stackableOverride: optionalCheckedOverride(form, 'stackableOverride'),
    rotationAllowedOverride: optionalCheckedOverride(form, 'rotationAllowedOverride'),
    notes: optionalText(form, 'notes'),
  });
  event.currentTarget.reset();
}

function optionalCheckedOverride(form: FormData, key: string) {
  return form.get(key) === 'on' ? true : undefined;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
