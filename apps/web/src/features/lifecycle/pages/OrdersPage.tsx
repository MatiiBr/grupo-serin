import { SellerPriority } from '@camiones/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../../../api/customers';
import { ordersApi } from '../../../api/orders';
import { productsApi } from '../../../api/products';
import { queryKeys } from '../../../api/queryKeys';
import { MutationError, QueryState, SectionTitle } from '../../../components/ui';
import { OrderList } from '../components/lifecycle-ui';
import { handleCustomerSubmit, handleOrderSubmit } from '../forms/lifecycleForms';
import { useOrderStatusMutation } from '../hooks/lifecycleHooks';

export function OrdersPage() {
  const queryClient = useQueryClient();
  const customers = useQuery({ queryKey: queryKeys.customers.search(), queryFn: () => customersApi.search() });
  const products = useQuery({ queryKey: queryKeys.productCatalog.search(), queryFn: () => productsApi.searchCatalog() });
  const orders = useQuery({ queryKey: queryKeys.orders.list(), queryFn: ordersApi.list });
  const createCustomer = useMutation({
    mutationFn: customersApi.create,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.customers.search() }),
  });
  const createOrder = useMutation({
    mutationFn: ordersApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.list() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dispatchDemand.list() });
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
