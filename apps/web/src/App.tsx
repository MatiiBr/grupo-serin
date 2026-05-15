import { useEffect } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from './components/ui';
import { DispatchPage, LifecyclePage, OrdersPage } from './features/lifecycle/LifecyclePage';
import { DestinationsPage, OperationPage, OperationsPage, PlannerPage, ProductsPage, ReportPage, TruckPage } from './features/operations/OperationPages';
import { setNavigateHandler } from './lib/navigation';

export function App() {
  const routerNavigate = useNavigate();

  useEffect(() => {
    setNavigateHandler(routerNavigate);
    return () => setNavigateHandler(null);
  }, [routerNavigate]);

  return (
    <div className="shell">
      <header className="masthead">
        <button className="brand" type="button" onClick={() => routerNavigate('/operations')}>
          <span>Camiones</span>
          <strong>Stowage Control</strong>
        </button>
        <nav className="top-nav" aria-label="Flujo logistico">
          <NavLink to="/operations">Carga</NavLink>
          <NavLink to="/lifecycle">Lifecycle</NavLink>
          <NavLink to="/orders">Pedidos</NavLink>
          <NavLink to="/dispatch">Dispatch</NavLink>
        </nav>
        <div className="status-strip">Acerera / Pedido / Dispatch / Carga</div>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/operations" replace />} />
        <Route path="/lifecycle" element={<LifecyclePage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/dispatch" element={<DispatchPage />} />
        <Route path="/operations" element={<OperationsPage />} />
        <Route path="/operations/:operationId" element={<OperationRoute page="summary" />} />
        <Route path="/operations/:operationId/truck" element={<OperationRoute page="truck" />} />
        <Route path="/operations/:operationId/destinations" element={<OperationRoute page="destinations" />} />
        <Route path="/operations/:operationId/products" element={<OperationRoute page="products" />} />
        <Route path="/operations/:operationId/planner" element={<OperationRoute page="planner" />} />
        <Route path="/operations/:operationId/report" element={<OperationRoute page="report" />} />
        <Route path="*" element={<EmptyState title="Ruta no encontrada" text="Volver al tablero de operaciones." />} />
      </Routes>
    </div>
  );
}

function OperationRoute({ page }: { page: 'summary' | 'truck' | 'destinations' | 'products' | 'planner' | 'report' }) {
  const { operationId } = useParams();

  if (!operationId) {
    return <EmptyState title="Operacion no encontrada" text="Volver al tablero de operaciones." />;
  }

  if (page === 'summary') return <OperationPage operationId={operationId} />;
  if (page === 'truck') return <TruckPage operationId={operationId} />;
  if (page === 'destinations') return <DestinationsPage operationId={operationId} />;
  if (page === 'products') return <ProductsPage operationId={operationId} />;
  if (page === 'planner') return <PlannerPage operationId={operationId} />;
  return <ReportPage operationId={operationId} />;
}
