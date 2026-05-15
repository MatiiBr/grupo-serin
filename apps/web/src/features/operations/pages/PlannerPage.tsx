import { PlanStatus } from '@camiones/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadingPlansApi } from '../../../api/loading-plans';
import { EmptyState, MutationError, QueryState } from '../../../components/ui';
import { navigate } from '../../../lib/navigation';
import { OperationHeader } from '../components/operation-ui';
import { PlanDetail } from '../components/planner-ui';
import { useOperation } from '../hooks/operationHooks';

export function PlannerPage({ operationId }: { operationId: string }) {
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
