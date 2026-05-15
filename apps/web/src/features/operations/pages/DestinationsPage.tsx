import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { destinationsApi } from '../../../api/destinations';
import { queryKeys } from '../../../api/queryKeys';
import { MutationError, QueryState, SectionTitle } from '../../../components/ui';
import { DestinationList, handleDestinationAssignmentSubmit, nextDestinationOrder, OperationHeader } from '../components/operation-ui';
import { useDeleteMutation, useOperation } from '../hooks/operationHooks';

export function DestinationsPage({ operationId }: { operationId: string }) {
  const queryClient = useQueryClient();
  const operation = useOperation(operationId);
  const catalog = useQuery({ queryKey: queryKeys.destinationCatalog.search(), queryFn: () => destinationsApi.searchCatalog() });
  const destinations = useQuery({ queryKey: queryKeys.destinationAssignments.list(operationId), queryFn: () => destinationsApi.listAssignments(operationId) });
  const createDestination = useMutation({
    mutationFn: (payload: Omit<Parameters<typeof destinationsApi.createAssignment>[1], 'unloadingOrder'>) =>
      destinationsApi.createAssignment(operationId, { ...payload, unloadingOrder: nextDestinationOrder(destinations.data ?? []) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.destinationAssignments.list(operationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.detail(operationId) });
    },
  });
  const reorderDestinations = useMutation({
    mutationFn: (ids: string[]) => destinationsApi.reorderAssignments(operationId, ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.destinationAssignments.list(operationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.detail(operationId) });
    },
  });
  const deleteDestination = useDeleteMutation((id: string) => destinationsApi.removeAssignment(id), queryKeys.destinationAssignments.list(operationId), queryKeys.operations.detail(operationId));

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
