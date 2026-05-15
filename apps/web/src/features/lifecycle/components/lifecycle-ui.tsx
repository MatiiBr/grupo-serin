import type { DispatchOrder, Order } from '../../../api/types';
import { formatDateMaybe } from '../../../lib/formatters';

export function LifecycleMetric<T>({ query, label, getValue }: { query: { data?: T[]; isLoading: boolean; error: Error | null }; label: string; getValue: (items: T[]) => string }) {
  const value = query.isLoading ? '...' : query.error ? '!' : getValue(query.data ?? []);
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

export function OrderList({ items, onHold, onRelease }: { items: Order[]; onHold: (id: string) => void; onRelease: (id: string) => void }) {
  if (items.length === 0) return <p className="muted">Sin pedidos cargados.</p>;
  return <div className="list compact">{items.map((item) => <div className="item" key={item.id}><span><strong>{item.code}</strong><small>{item.customer?.name ?? item.customerId} / {item.status} / credito {item.creditStatus} / prioridad {item.sellerPriority} / {item.destinationName ?? 'sin destino'} / {item.items?.length ?? 0} items</small></span><span className="actions"><button className="ghost" type="button" onClick={() => onHold(item.id)}>Hold credito</button><button className="ghost" type="button" onClick={() => onRelease(item.id)}>Liberar</button></span></div>)}</div>;
}

export function DemandList({ items, onCreate }: { items: Order[]; onCreate: (orderId: string) => void }) {
  if (items.length === 0) return <p className="muted">No hay pedidos liberados para dispatch.</p>;
  return <div className="list compact">{items.map((item) => <div className="item" key={item.id}><span><strong>{item.code}</strong><small>{item.customer?.name ?? item.customerId} / prioridad {item.sellerPriority} / {item.destinationName ?? 'sin destino'} / {formatDateMaybe(item.requestedDeliveryAt)}</small></span><button className="ghost" type="button" onClick={() => onCreate(item.id)}>Crear dispatch</button></div>)}</div>;
}

export function DispatchOrderList({ items, onReady, onCreateLoad }: { items: DispatchOrder[]; onReady: (id: string) => void; onCreateLoad: (id: string) => void }) {
  if (items.length === 0) return <p className="muted">Sin dispatch orders.</p>;
  return <div className="list compact">{items.map((item) => <div className="item" key={item.id}><span><strong>{item.code}</strong><small>{item.status} / pedido {item.order?.code ?? item.orderId} / {item.destinationNameSnapshot ?? 'sin destino'} / {item.items?.length ?? 0} items{item.loadOperationId ? ` / OP ${item.loadOperationId.slice(0, 8)}` : ''}</small></span><span className="actions"><button className="ghost" type="button" disabled={item.status !== 'PLANNED'} onClick={() => onReady(item.id)}>Ready</button><button className="ghost" type="button" disabled={item.status === 'PLANNED'} onClick={() => onCreateLoad(item.id)}>Crear carga</button></span></div>)}</div>;
}
