import { QueryState, SectionTitle } from '../../../components/ui';
import { DashboardLink, MetricGrid, OperationHeader } from '../components/operation-ui';
import { useOperation } from '../hooks/operationHooks';

export function OperationPage({ operationId }: { operationId: string }) {
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
