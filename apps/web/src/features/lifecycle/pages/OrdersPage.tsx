import { SellerPriority } from '@camiones/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { customersApi } from '../../../api/customers';
import { ordersApi } from '../../../api/orders';
import { productsApi } from '../../../api/products';
import { queryKeys } from '../../../api/queryKeys';
import { MutationError, QueryState, SectionTitle } from '../../../components/ui';
import { OrderList } from '../components/lifecycle-ui';
import { useOrderStatusMutation } from '../hooks/lifecycleHooks';

interface CustomerFormValues {
  code: string;
  name: string;
  taxId?: string;
  notes?: string;
}

interface OrderFormValues {
  customerId: string;
  sellerPriority: SellerPriority;
  productCatalogId: string;
  productCode?: string;
  destinationName?: string;
  requestedDeliveryAt?: string;
  quantity?: string;
  notes?: string;
}

export function OrdersPage() {
  const queryClient = useQueryClient();
  const customerForm = useForm<CustomerFormValues>();
  const orderForm = useForm<OrderFormValues>({ defaultValues: { sellerPriority: SellerPriority.NORMAL, quantity: '1' } });
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

  const onCustomerSubmit = customerForm.handleSubmit((values) => {
    createCustomer.mutate({
      code: requiredValue(values.code),
      name: requiredValue(values.name),
      taxId: optionalValue(values.taxId),
      notes: optionalValue(values.notes),
    });
    customerForm.reset();
  });

  const onOrderSubmit = orderForm.handleSubmit((values) => {
    const selectedProduct = products.data?.find((product) => product.id === values.productCatalogId);
    createOrder.mutate({
      customerId: requiredValue(values.customerId),
      sellerPriority: values.sellerPriority,
      destinationName: optionalValue(values.destinationName),
      requestedDeliveryAt: optionalDate(values.requestedDeliveryAt),
      notes: optionalValue(values.notes),
      items: [{
        productCatalogId: values.productCatalogId,
        productCode: optionalValue(values.productCode) ?? selectedProduct?.code ?? values.productCatalogId,
        description: selectedProduct?.description ?? undefined,
        quantity: optionalInteger(values.quantity),
      }],
    });
    orderForm.reset();
  });

  return (
    <main className="grid two">
      <section className="card">
        <SectionTitle title="Alta cliente" subtitle="base manual de intake" />
        <form className="form" onSubmit={onCustomerSubmit}>
          <label>Codigo cliente<input placeholder="CLI-ACME" required {...customerForm.register('code', { required: true })} /></label>
          <label>Razon social<input placeholder="Aceros del Norte" required {...customerForm.register('name', { required: true })} /></label>
          <label>CUIT / Tax ID<input placeholder="30-..." {...customerForm.register('taxId')} /></label>
          <label>Notas<textarea rows={3} {...customerForm.register('notes')} /></label>
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
                <form className="form" onSubmit={onOrderSubmit}>
                  <label>Cliente<select required {...orderForm.register('customerId', { required: true })}><option value="">Seleccionar cliente</option>{customerItems.map((customer) => <option key={customer.id} value={customer.id}>{customer.code} / {customer.name}</option>)}</select></label>
                  <label>Prioridad<select {...orderForm.register('sellerPriority')}>{Object.values(SellerPriority).map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label>
                  <label>Producto catalogo<select required {...orderForm.register('productCatalogId', { required: true })}><option value="">Seleccionar SKU</option>{productItems.map((product) => <option key={product.id} value={product.id}>{product.code} / {product.family}</option>)}</select></label>
                  <label>Codigo producto snapshot<input placeholder="se usa el codigo catalogo si queda vacio" {...orderForm.register('productCode')} /></label>
                  <label>Destino snapshot<input placeholder="Planta / obra destino" {...orderForm.register('destinationName')} /></label>
                  <label>Entrega solicitada<input type="datetime-local" {...orderForm.register('requestedDeliveryAt')} /></label>
                  <label>Cantidad<input min="1" type="number" {...orderForm.register('quantity')} /></label>
                  <label>Notas<textarea rows={3} {...orderForm.register('notes')} /></label>
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

function requiredValue(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error('El campo es requerido');
  return normalized;
}

function optionalValue(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function optionalDate(value?: string) {
  const normalized = optionalValue(value);
  return normalized ? new Date(normalized).toISOString() : undefined;
}

function optionalInteger(value?: string) {
  const normalized = optionalValue(value);
  return normalized ? Number.parseInt(normalized, 10) : undefined;
}
