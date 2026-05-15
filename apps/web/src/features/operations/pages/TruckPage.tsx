import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../api/queryKeys';
import { trucksApi } from '../../../api/trucks';
import { MutationError, QueryState, SectionTitle } from '../../../components/ui';
import { optionalText, requiredText } from '../../../lib/forms';
import { OperationHeader, VehicleAssignmentSummary } from '../components/operation-ui';
import { useOperation } from '../hooks/operationHooks';

export function TruckPage({ operationId }: { operationId: string }) {
  const queryClient = useQueryClient();
  const operation = useOperation(operationId);
  const trucks = useQuery({ queryKey: queryKeys.truckCatalog.search(), queryFn: () => trucksApi.searchCatalog() });
  const trailers = useQuery({ queryKey: queryKeys.trailerCatalog.search(), queryFn: () => trucksApi.searchTrailers() });
  const vehicle = useQuery({ queryKey: queryKeys.vehicleAssignment.detail(operationId), queryFn: () => trucksApi.getAssignment(operationId) });
  const saveVehicle = useMutation({
    mutationFn: trucksApi.upsertAssignment.bind(null, operationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.vehicleAssignment.detail(operationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.detail(operationId) });
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
