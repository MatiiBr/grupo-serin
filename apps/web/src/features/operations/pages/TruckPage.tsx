import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { queryKeys } from '../../../api/queryKeys';
import { trucksApi } from '../../../api/trucks';
import { MutationError, QueryState, SectionTitle } from '../../../components/ui';
import { OperationHeader, VehicleAssignmentSummary } from '../components/operation-ui';
import { useOperation } from '../hooks/operationHooks';

interface VehicleFormValues {
  truckCatalogId: string;
  trailerCatalogId?: string;
  notes?: string;
}

export function TruckPage({ operationId }: { operationId: string }) {
  const queryClient = useQueryClient();
  const { handleSubmit, register, reset } = useForm<VehicleFormValues>();
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

  const onSubmit = handleSubmit((values) => {
    saveVehicle.mutate({
      truckCatalogId: values.truckCatalogId,
      trailerCatalogId: optionalValue(values.trailerCatalogId) ?? null,
      notes: optionalValue(values.notes),
    });
  });

  useEffect(() => {
    reset({
      truckCatalogId: vehicle.data?.truckCatalogId ?? '',
      trailerCatalogId: vehicle.data?.trailerCatalogId ?? '',
      notes: vehicle.data?.notes ?? '',
    });
  }, [reset, vehicle.data?.notes, vehicle.data?.trailerCatalogId, vehicle.data?.truckCatalogId]);

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
              onSubmit={onSubmit}
            >
              <label>Camion de catalogo<select required {...register('truckCatalogId')}><option value="">Seleccionar camion</option>{truckItems.map((truck) => <option key={truck.id} value={truck.id}>{truck.plate} / {truck.loadingMethod} / {truck.lengthMm ?? '-'}x{truck.widthMm ?? '-'} mm</option>)}</select></label>
              <label>Acoplado<select {...register('trailerCatalogId')}><option value="">Sin acoplado</option>{trailerItems.map((trailer) => <option key={trailer.id} value={trailer.id}>{trailer.code} / {trailer.lengthMm ?? '-'}x{trailer.widthMm ?? '-'} mm</option>)}</select></label>
              <label>Notas operativas<textarea rows={3} {...register('notes')} /></label>
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

function optionalValue(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
