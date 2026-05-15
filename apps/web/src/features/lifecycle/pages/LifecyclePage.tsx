import { useQuery } from '@tanstack/react-query';
import { dispatchApi } from '../../../api/dispatch';
import { operationsApi } from '../../../api/operations';
import { ordersApi } from '../../../api/orders';
import { queryKeys } from '../../../api/queryKeys';
import { SectionTitle } from '../../../components/ui';
import { navigate } from '../../../lib/navigation';
import { LifecycleMetric } from '../components/lifecycle-ui';

export function LifecyclePage() {
  const orders = useQuery({ queryKey: queryKeys.orders.list(), queryFn: ordersApi.list });
  const dispatchOrders = useQuery({ queryKey: queryKeys.dispatchOrders.list(), queryFn: dispatchApi.listDispatchOrders });
  const operations = useQuery({ queryKey: queryKeys.operations.list(), queryFn: operationsApi.list });

  return (
    <main className="grid two">
      <section className="card hero-card lifecycle-hero">
        <p className="eyebrow">Rebaseline / Slice 3</p>
        <h1>Puente operativo</h1>
        <p className="lede">Ingreso manual de pedidos, control de prioridad/credito y handoff a carga sin convertir LoadOperation en ERP.</p>
      </section>
      <section className="card stack">
        <SectionTitle title="Cadena minima" subtitle="manual, trazable, revisable" />
        <button className="dash" type="button" onClick={() => navigate('/orders')}><span>1 / Intake</span><strong>Cliente + pedido</strong></button>
        <button className="dash" type="button" onClick={() => navigate('/orders')}><span>2 / Gate comercial</span><strong>Credito hold/release</strong></button>
        <button className="dash" type="button" onClick={() => navigate('/dispatch')}><span>3 / Dispatch</span><strong>Snapshot → carga</strong></button>
      </section>
      <section className="card span">
        <SectionTitle title="Radar logistico" subtitle="estado actual de la demanda" />
        <div className="metrics">
          <LifecycleMetric query={orders} label="Pedidos" getValue={(items) => String(items.length)} />
          <LifecycleMetric query={orders} label="Liberados" getValue={(items) => String(items.filter((item) => item.status === 'RELEASED').length)} />
          <LifecycleMetric query={dispatchOrders} label="Dispatch" getValue={(items) => String(items.length)} />
          <LifecycleMetric query={dispatchOrders} label="Listos carga" getValue={(items) => String(items.filter((item) => item.status === 'READY_TO_LOAD').length)} />
          <LifecycleMetric query={dispatchOrders} label="Handoff" getValue={(items) => String(items.filter((item) => item.loadOperationId).length)} />
          <LifecycleMetric query={operations} label="Operaciones" getValue={(items) => String(items.length)} />
        </div>
      </section>
    </main>
  );
}
