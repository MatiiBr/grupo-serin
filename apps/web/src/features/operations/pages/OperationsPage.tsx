import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { operationsApi } from '../../../api/operations';
import { queryKeys } from '../../../api/queryKeys';
import { MutationError, QueryState, SectionTitle } from '../../../components/ui';
import { navigate } from '../../../lib/navigation';
import { OperationRow } from '../components/operation-ui';

interface OperationFormValues {
  code?: string;
  name?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  notes?: string;
}

export function OperationsPage() {
  const queryClient = useQueryClient();
  const { handleSubmit, register } = useForm<OperationFormValues>({ defaultValues: { scheduledTime: '08:00' } });
  const operations = useQuery({ queryKey: queryKeys.operations.list(), queryFn: operationsApi.list });
  const createOperation = useMutation({
    mutationFn: operationsApi.create,
    onSuccess: (operation) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.list() });
      navigate(`/operations/${operation.id}`);
    },
  });

  const onSubmit = handleSubmit((values) => {
    createOperation.mutate({
      code: optionalValue(values.code),
      name: optionalValue(values.name),
      notes: optionalValue(values.notes),
      scheduledAt: values.scheduledDate ? new Date(`${values.scheduledDate}T${values.scheduledTime || '00:00'}`).toISOString() : undefined,
    });
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
        <form className="form" onSubmit={onSubmit}>
          <label>Codigo<input placeholder="OP-2026-001" {...register('code')} /></label>
          <label>Nombre<input placeholder="Carga obra norte" {...register('name')} /></label>
          <fieldset className="date-time-field">
            <legend>Programada</legend>
            <label>Fecha<input type="date" {...register('scheduledDate')} /></label>
            <label>Hora<input type="time" {...register('scheduledTime')} /></label>
          </fieldset>
          <label>Notas<textarea rows={3} {...register('notes')} /></label>
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

function optionalValue(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
