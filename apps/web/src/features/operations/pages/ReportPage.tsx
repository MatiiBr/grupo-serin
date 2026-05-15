import { useQuery } from '@tanstack/react-query';
import { loadingPlansApi } from '../../../api/loading-plans';
import { queryKeys } from '../../../api/queryKeys';
import { EmptyState, QueryState } from '../../../components/ui';
import { OperationalReport } from '../components/report-ui';

export function ReportPage({ operationId }: { operationId: string }) {
  const currentPlan = useQuery({ queryKey: queryKeys.loadingPlan.current(operationId), queryFn: () => loadingPlansApi.current(operationId) });
  const planId = currentPlan.data?.id;
  const report = useQuery({
    queryKey: queryKeys.loadingPlan.report(planId),
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
