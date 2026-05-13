import { SellerPriority } from '@camiones/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../../api/customers';
import { dispatchApi } from '../../api/dispatch';
import { operationsApi } from '../../api/operations';
import { ordersApi } from '../../api/orders';
import { productsApi } from '../../api/products';
import type { DispatchOrder, Order, ProductCatalog } from '../../api/types';
import { MutationError, QueryState, SectionTitle } from '../../components/ui';
import { optionalDate, optionalInteger, optionalText, requiredText } from '../../lib/forms';
import { formatDateMaybe } from '../../lib/formatters';
import { navigate } from '../../lib/navigation';

export function LifecyclePage() {
  const orders = useQuery({ queryKey: ['orders'], queryFn: ordersApi.list });
  const dispatchOrders = useQuery({ queryKey: ['dispatch-orders'], queryFn: dispatchApi.listDispatchOrders });
  const operations = useQuery({ queryKey: ['operations'], queryFn: operationsApi.list });

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

export function OrdersPage() {
  const queryClient = useQueryClient();
  const customers = useQuery({ queryKey: ['customers'], queryFn: () => customersApi.search() });
  const products = useQuery({ queryKey: ['product-catalog'], queryFn: () => productsApi.searchCatalog() });
  const orders = useQuery({ queryKey: ['orders'], queryFn: ordersApi.list });
  const createCustomer = useMutation({
    mutationFn: customersApi.create,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });
  const createOrder = useMutation({
    mutationFn: ordersApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['dispatch-demand'] });
    },
  });
  const holdCredit = useOrderStatusMutation(ordersApi.holdCredit);
  const releaseCredit = useOrderStatusMutation(ordersApi.releaseCredit);

  return (
    <main className="grid two">
      <section className="card">
        <SectionTitle title="Alta cliente" subtitle="base manual de intake" />
        <form className="form" onSubmit={(event) => handleCustomerSubmit(event, createCustomer.mutate)}>
          <label>Codigo cliente<input name="code" placeholder="CLI-ACME" required /></label>
          <label>Razon social<input name="name" placeholder="Aceros del Norte" required /></label>
          <label>CUIT / Tax ID<input name="taxId" placeholder="30-..." /></label>
          <label>Notas<textarea name="notes" rows={3} /></label>
          <button disabled={createCustomer.isPending}>Crear cliente</button>
          <MutationError error={createCustomer.error} />
        </form>
      </section>
      <section className="card">
        <SectionTitle title="Nuevo pedido" subtitle="un item minimo para dispatch" />
        <QueryState query={customers}>
          {(customerItems) => (
            <QueryState query={products}>
              {(productItems) => (
                <form className="form" onSubmit={(event) => handleOrderSubmit(event, createOrder.mutate, productItems)}>
                  <label>Cliente<select name="customerId" required><option value="">Seleccionar cliente</option>{customerItems.map((customer) => <option key={customer.id} value={customer.id}>{customer.code} / {customer.name}</option>)}</select></label>
                  <label>Prioridad<select name="sellerPriority" defaultValue={SellerPriority.NORMAL}>{Object.values(SellerPriority).map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label>
                  <label>Producto catalogo<select name="productCatalogId" required><option value="">Seleccionar SKU</option>{productItems.map((product) => <option key={product.id} value={product.id}>{product.code} / {product.family}</option>)}</select></label>
                  <label>Codigo producto snapshot<input name="productCode" placeholder="se usa el codigo catalogo si queda vacio" /></label>
                  <label>Destino snapshot<input name="destinationName" placeholder="Planta / obra destino" /></label>
                  <label>Entrega solicitada<input name="requestedDeliveryAt" type="datetime-local" /></label>
                  <label>Cantidad<input name="quantity" min="1" type="number" defaultValue="1" /></label>
                  <label>Notas<textarea name="notes" rows={3} /></label>
                  <button disabled={createOrder.isPending || customerItems.length === 0 || productItems.length === 0}>Crear pedido</button>
                  <MutationError error={createOrder.error} />
                </form>
              )}
            </QueryState>
          )}
        </QueryState>
      </section>
      <section className="card span">
        <SectionTitle title="Pedidos" subtitle="status, credito y prioridad visibles" />
        <QueryState query={orders}>{(items) => <OrderList items={items} onHold={(id) => holdCredit.mutate(id)} onRelease={(id) => releaseCredit.mutate(id)} />}</QueryState>
        <MutationError error={holdCredit.error ?? releaseCredit.error} />
      </section>
    </main>
  );
}

export function DispatchPage() {
  const queryClient = useQueryClient();
  const demand = useQuery({ queryKey: ['dispatch-demand'], queryFn: ordersApi.dispatchDemand });
  const dispatchOrders = useQuery({ queryKey: ['dispatch-orders'], queryFn: dispatchApi.listDispatchOrders });
  const createDispatchOrder = useMutation({
    mutationFn: dispatchApi.createDispatchOrder,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dispatch-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
  const markReady = useDispatchMutation(dispatchApi.markReady);
  const createLoadOperation = useMutation({
    mutationFn: dispatchApi.createLoadOperation,
    onSuccess: (operation) => {
      void queryClient.invalidateQueries({ queryKey: ['dispatch-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['operations'] });
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

function LifecycleMetric<T>({ query, label, getValue }: { query: { data?: T[]; isLoading: boolean; error: Error | null }; label: string; getValue: (items: T[]) => string }) {
  const value = query.isLoading ? '...' : query.error ? '!' : getValue(query.data ?? []);
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function OrderList({ items, onHold, onRelease }: { items: Order[]; onHold: (id: string) => void; onRelease: (id: string) => void }) {
  if (items.length === 0) return <p className="muted">Sin pedidos cargados.</p>;
  return <div className="list compact">{items.map((item) => <div className="item" key={item.id}><span><strong>{item.code}</strong><small>{item.customer?.name ?? item.customerId} / {item.status} / credito {item.creditStatus} / prioridad {item.sellerPriority} / {item.destinationName ?? 'sin destino'} / {item.items?.length ?? 0} items</small></span><span className="actions"><button className="ghost" type="button" onClick={() => onHold(item.id)}>Hold credito</button><button className="ghost" type="button" onClick={() => onRelease(item.id)}>Liberar</button></span></div>)}</div>;
}

function DemandList({ items, onCreate }: { items: Order[]; onCreate: (orderId: string) => void }) {
  if (items.length === 0) return <p className="muted">No hay pedidos liberados para dispatch.</p>;
  return <div className="list compact">{items.map((item) => <div className="item" key={item.id}><span><strong>{item.code}</strong><small>{item.customer?.name ?? item.customerId} / prioridad {item.sellerPriority} / {item.destinationName ?? 'sin destino'} / {formatDateMaybe(item.requestedDeliveryAt)}</small></span><button className="ghost" type="button" onClick={() => onCreate(item.id)}>Crear dispatch</button></div>)}</div>;
}

function DispatchOrderList({ items, onReady, onCreateLoad }: { items: DispatchOrder[]; onReady: (id: string) => void; onCreateLoad: (id: string) => void }) {
  if (items.length === 0) return <p className="muted">Sin dispatch orders.</p>;
  return <div className="list compact">{items.map((item) => <div className="item" key={item.id}><span><strong>{item.code}</strong><small>{item.status} / pedido {item.order?.code ?? item.orderId} / {item.destinationNameSnapshot ?? 'sin destino'} / {item.items?.length ?? 0} items{item.loadOperationId ? ` / OP ${item.loadOperationId.slice(0, 8)}` : ''}</small></span><span className="actions"><button className="ghost" type="button" disabled={item.status !== 'PLANNED'} onClick={() => onReady(item.id)}>Ready</button><button className="ghost" type="button" disabled={item.status === 'PLANNED'} onClick={() => onCreateLoad(item.id)}>Crear carga</button></span></div>)}</div>;
}

function useOrderStatusMutation(mutationFn: (id: string) => Promise<Order>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['dispatch-demand'] });
    },
  });
}

function useDispatchMutation(mutationFn: (id: string) => Promise<DispatchOrder>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['dispatch-orders'] }),
  });
}

function handleCustomerSubmit(event: React.FormEvent<HTMLFormElement>, submit: (payload: Parameters<typeof customersApi.create>[0]) => void) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  submit({
    code: requiredText(form, 'code'),
    name: requiredText(form, 'name'),
    taxId: optionalText(form, 'taxId'),
    notes: optionalText(form, 'notes'),
  });
  event.currentTarget.reset();
}

function handleOrderSubmit(event: React.FormEvent<HTMLFormElement>, submit: (payload: Parameters<typeof ordersApi.create>[0]) => void, products: ProductCatalog[]) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const productCatalogId = requiredText(form, 'productCatalogId');
  const selectedProduct = products.find((product) => product.id === productCatalogId);
  submit({
    customerId: requiredText(form, 'customerId'),
    sellerPriority: requiredText(form, 'sellerPriority') as SellerPriority,
    destinationName: optionalText(form, 'destinationName'),
    requestedDeliveryAt: optionalDate(form, 'requestedDeliveryAt'),
    notes: optionalText(form, 'notes'),
    items: [{
      productCatalogId,
      productCode: optionalText(form, 'productCode') ?? selectedProduct?.code ?? productCatalogId,
      description: selectedProduct?.description ?? undefined,
      quantity: optionalInteger(form, 'quantity'),
    }],
  });
  event.currentTarget.reset();
}
