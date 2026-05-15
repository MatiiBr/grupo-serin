import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { operationsApi } from '../../../api/operations';
import { MutationError, QueryState, SectionTitle } from '../../../components/ui';
import { optionalText } from '../../../lib/forms';
import { navigate } from '../../../lib/navigation';
import { OperationRow } from '../components/operation-ui';

export function OperationsPage() {
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
            const scheduledDate = optionalText(form, 'scheduledDate');
            const scheduledTime = optionalText(form, 'scheduledTime') ?? '00:00';
            createOperation.mutate({
              code: optionalText(form, 'code'),
              name: optionalText(form, 'name'),
              notes: optionalText(form, 'notes'),
              scheduledAt: scheduledDate ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString() : undefined,
            });
          }}
        >
          <label>Codigo<input name="code" placeholder="OP-2026-001" /></label>
          <label>Nombre<input name="name" placeholder="Carga obra norte" /></label>
          <fieldset className="date-time-field">
            <legend>Programada</legend>
            <label>Fecha<input name="scheduledDate" type="date" /></label>
            <label>Hora<input name="scheduledTime" type="time" defaultValue="08:00" /></label>
          </fieldset>
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
