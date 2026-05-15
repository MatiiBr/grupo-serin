import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dispatchApi } from '../../../api/dispatch';
import { ordersApi } from '../../../api/orders';
import { queryKeys } from '../../../api/queryKeys';
import { MutationError, QueryState, SectionTitle } from '../../../components/ui';
import { navigate } from '../../../lib/navigation';
import { DemandList, DispatchOrderList } from '../components/lifecycle-ui';
import { useDispatchMutation } from '../hooks/lifecycleHooks';

export function DispatchPage() {
  const queryClient = useQueryClient();
  const demand = useQuery({ queryKey: queryKeys.dispatchDemand.list(), queryFn: ordersApi.dispatchDemand });
  const dispatchOrders = useQuery({ queryKey: queryKeys.dispatchOrders.list(), queryFn: dispatchApi.listDispatchOrders });
  const createDispatchOrder = useMutation({
    mutationFn: dispatchApi.createDispatchOrder,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dispatchOrders.list() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.list() });
    },
  });
  const markReady = useDispatchMutation(dispatchApi.markReady);
  const createLoadOperation = useMutation({
    mutationFn: dispatchApi.createLoadOperation,
    onSuccess: (operation) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dispatchOrders.list() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.list() });
      navigate(`/operations/${operation.id}`);
    },
  });

  return (
    <main className="grid two">
      <section className="card">
        <SectionTitle title="Demanda liberada" subtitle="pedidos que pueden alimentar dispatch" />
        <QueryState query={demand}>{(items) => <DemandList items={items} onCreate={(orderId) => createDispatchOrder.mutate({ orderId })} />}</QueryState>
        <MutationError error={createDispatchOrder.error} />
      </section>
      <section className="card">
        <SectionTitle title="Handoff a carga" subtitle="READY_TO_LOAD crea snapshot LoadOperation" />
        <QueryState query={dispatchOrders}>{(items) => <DispatchOrderList items={items} onReady={(id) => markReady.mutate(id)} onCreateLoad={(id) => createLoadOperation.mutate(id)} />}</QueryState>
        <MutationError error={markReady.error ?? createLoadOperation.error} />
      </section>
    </main>
  );
}
