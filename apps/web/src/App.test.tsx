import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const operationsApiMock = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  list: vi.fn(async () => []),
}));
const customersApiMock = vi.hoisted(() => ({
  create: vi.fn(),
  search: vi.fn(async () => []),
}));
const dispatchApiMock = vi.hoisted(() => ({
  createDispatchOrder: vi.fn(),
  createLoadOperation: vi.fn(),
  listDispatchOrders: vi.fn(async () => []),
  markReady: vi.fn(),
}));
const ordersApiMock = vi.hoisted(() => ({
  create: vi.fn(),
  dispatchDemand: vi.fn(async () => []),
  holdCredit: vi.fn(),
  list: vi.fn(async () => []),
  releaseCredit: vi.fn(),
}));
const trucksApiMock = vi.hoisted(() => ({
  getAssignment: vi.fn(),
  searchCatalog: vi.fn(),
  searchTrailers: vi.fn(),
  upsertAssignment: vi.fn(),
}));
const destinationsApiMock = vi.hoisted(() => ({
  createAssignment: vi.fn(),
  listAssignments: vi.fn(),
  removeAssignment: vi.fn(),
  reorderAssignments: vi.fn(),
  searchCatalog: vi.fn(),
}));
const productsApiMock = vi.hoisted(() => ({
  createAssignment: vi.fn(),
  listAssignments: vi.fn(),
  removeAssignment: vi.fn(),
  searchCatalog: vi.fn(),
}));

vi.mock('./api/operations', () => ({
  operationsApi: operationsApiMock,
}));
vi.mock('./api/customers', () => ({
  customersApi: customersApiMock,
}));
vi.mock('./api/dispatch', () => ({
  dispatchApi: dispatchApiMock,
}));
vi.mock('./api/orders', () => ({
  ordersApi: ordersApiMock,
}));
vi.mock('./api/trucks', () => ({
  trucksApi: trucksApiMock,
}));
vi.mock('./api/destinations', () => ({
  destinationsApi: destinationsApiMock,
}));
vi.mock('./api/products', () => ({
  productsApi: productsApiMock,
}));

function renderApp(route: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('App routing', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    operationsApiMock.create.mockReset();
    operationsApiMock.create.mockResolvedValue({ id: 'op-1' });
    operationsApiMock.get.mockReset();
    operationsApiMock.get.mockResolvedValue({
      id: 'op-1',
      code: 'OP01',
      status: 'DRAFT',
      name: 'Carga obra norte',
      notes: 'Turno manana',
      scheduledAt: new Date('2026-05-20T09:30').toISOString(),
      createdAt: new Date('2026-05-15T00:00').toISOString(),
      updatedAt: new Date('2026-05-15T00:00').toISOString(),
      truck: null,
      destinations: [],
      products: [],
      latestPlan: null,
    });
    operationsApiMock.list.mockClear();

    customersApiMock.create.mockReset();
    customersApiMock.create.mockResolvedValue({ id: 'customer-1' });
    customersApiMock.search.mockReset();
    customersApiMock.search.mockResolvedValue([]);

    dispatchApiMock.createDispatchOrder.mockReset();
    dispatchApiMock.createDispatchOrder.mockResolvedValue({ id: 'dispatch-1' });
    dispatchApiMock.createLoadOperation.mockReset();
    dispatchApiMock.createLoadOperation.mockResolvedValue({ id: 'op-1' });
    dispatchApiMock.listDispatchOrders.mockReset();
    dispatchApiMock.listDispatchOrders.mockResolvedValue([]);
    dispatchApiMock.markReady.mockReset();
    dispatchApiMock.markReady.mockResolvedValue({ id: 'dispatch-1' });

    ordersApiMock.create.mockReset();
    ordersApiMock.create.mockResolvedValue({ id: 'order-1' });
    ordersApiMock.dispatchDemand.mockReset();
    ordersApiMock.dispatchDemand.mockResolvedValue([]);
    ordersApiMock.holdCredit.mockReset();
    ordersApiMock.holdCredit.mockResolvedValue({ id: 'order-1' });
    ordersApiMock.list.mockReset();
    ordersApiMock.list.mockResolvedValue([]);
    ordersApiMock.releaseCredit.mockReset();
    ordersApiMock.releaseCredit.mockResolvedValue({ id: 'order-1' });

    trucksApiMock.searchCatalog.mockReset();
    trucksApiMock.searchCatalog.mockResolvedValue([{ id: 'truck-1', plate: 'ABC123', loadingMethod: 'SIDE', lengthMm: 12000, widthMm: 2400 }]);
    trucksApiMock.searchTrailers.mockReset();
    trucksApiMock.searchTrailers.mockResolvedValue([{ id: 'trailer-1', code: 'TRL1', lengthMm: 8000, widthMm: 2400 }]);
    trucksApiMock.getAssignment.mockReset();
    trucksApiMock.getAssignment.mockResolvedValue(null);
    trucksApiMock.upsertAssignment.mockReset();
    trucksApiMock.upsertAssignment.mockResolvedValue({ id: 'vehicle-1' });

    destinationsApiMock.searchCatalog.mockReset();
    destinationsApiMock.searchCatalog.mockResolvedValue([{ id: 'dest-1', name: 'Obra Norte', code: 'ON' }]);
    destinationsApiMock.listAssignments.mockReset();
    destinationsApiMock.listAssignments.mockResolvedValue([{ id: 'op-dest-1', destinationCatalogId: 'dest-1', unloadingOrder: 1, notes: null, catalog: { name: 'Obra Norte', code: 'ON' } }]);
    destinationsApiMock.createAssignment.mockReset();
    destinationsApiMock.createAssignment.mockResolvedValue({ id: 'op-dest-2' });

    productsApiMock.searchCatalog.mockReset();
    productsApiMock.searchCatalog.mockResolvedValue([{ id: 'prod-1', code: 'SKU1', family: 'STEEL_BAR', lengthMm: 1000, widthMm: 100, heightMm: 100 }]);
    productsApiMock.listAssignments.mockReset();
    productsApiMock.listAssignments.mockResolvedValue([]);
    productsApiMock.createAssignment.mockReset();
    productsApiMock.createAssignment.mockResolvedValue({ id: 'op-prod-1' });
  });

  it('renders the operations route', async () => {
    renderApp('/operations');

    expect(await screen.findByRole('heading', { name: /nueva operacion/i })).toBeInTheDocument();
  });

  it('renders the lifecycle route', async () => {
    renderApp('/lifecycle');

    expect(await screen.findByRole('heading', { name: /puente operativo/i })).toBeInTheDocument();
  });

  it('renders the orders route', async () => {
    renderApp('/orders');

    expect(await screen.findByRole('heading', { name: /alta cliente/i })).toBeInTheDocument();
  });

  it('renders the dispatch route', async () => {
    renderApp('/dispatch');

    expect(await screen.findByRole('heading', { name: /demanda liberada/i })).toBeInTheDocument();
  });

  it('renders the not-found route', () => {
    renderApp('/ruta-inexistente');

    expect(screen.getByText(/ruta no encontrada/i)).toBeInTheDocument();
  });

  it('submits the customer form payload', async () => {
    const user = userEvent.setup();
    renderApp('/orders');

    await user.type(await screen.findByLabelText(/codigo cliente/i), ' CLI-ACME ');
    await user.type(screen.getByLabelText(/razon social/i), ' Aceros del Norte ');
    await user.type(screen.getByLabelText(/cuit/i), ' 30-12345678-9 ');
    await user.type(screen.getAllByLabelText(/notas/i)[0], ' Cliente estrategico ');
    await user.click(screen.getByRole('button', { name: /crear cliente/i }));

    await waitFor(() => expect(customersApiMock.create).toHaveBeenCalledTimes(1));
    expect(customersApiMock.create.mock.calls[0]?.[0]).toEqual({
      code: 'CLI-ACME',
      name: 'Aceros del Norte',
      taxId: '30-12345678-9',
      notes: 'Cliente estrategico',
    });
  });

  it('submits the order form payload with product fallback', async () => {
    const user = userEvent.setup();
    customersApiMock.search.mockResolvedValue([{ id: 'customer-1', code: 'CLI-ACME', name: 'Aceros del Norte', status: 'ACTIVE' }] as never);
    renderApp('/orders');

    await user.selectOptions(await screen.findByLabelText(/^cliente$/i), 'customer-1');
    await user.selectOptions(screen.getByLabelText(/prioridad/i), 'HIGH');
    await user.selectOptions(screen.getByLabelText(/producto catalogo/i), 'prod-1');
    await user.type(screen.getByLabelText(/destino snapshot/i), ' Obra Norte ');
    await user.type(screen.getByLabelText(/entrega solicitada/i), '2026-05-20T09:30');
    await user.clear(screen.getByLabelText(/cantidad/i));
    await user.type(screen.getByLabelText(/cantidad/i), '4');
    await user.type(screen.getAllByLabelText(/notas/i)[1], ' Prioritario ');
    await user.click(screen.getByRole('button', { name: /crear pedido/i }));

    await waitFor(() => expect(ordersApiMock.create).toHaveBeenCalledTimes(1));
    expect(ordersApiMock.create.mock.calls[0]?.[0]).toEqual({
      customerId: 'customer-1',
      sellerPriority: 'HIGH',
      destinationName: 'Obra Norte',
      requestedDeliveryAt: new Date('2026-05-20T09:30').toISOString(),
      notes: 'Prioritario',
      items: [{
        productCatalogId: 'prod-1',
        productCode: 'SKU1',
        description: undefined,
        quantity: 4,
      }],
    });
  });

  it('submits the operation form payload', async () => {
    const user = userEvent.setup();
    renderApp('/operations');

    await user.type(screen.getByLabelText(/codigo/i), ' OP01 ');
    await user.type(screen.getByLabelText(/nombre/i), ' Carga obra norte ');
    await user.type(screen.getByLabelText(/fecha/i), '2026-05-20');
    await user.clear(screen.getByLabelText(/hora/i));
    await user.type(screen.getByLabelText(/hora/i), '09:30');
    await user.type(screen.getByLabelText(/notas/i), ' Turno manana ');
    await user.click(screen.getByRole('button', { name: /crear operacion/i }));

    await waitFor(() => expect(operationsApiMock.create).toHaveBeenCalledTimes(1));
    expect(operationsApiMock.create.mock.calls[0]?.[0]).toEqual({
      code: 'OP01',
      name: 'Carga obra norte',
      notes: 'Turno manana',
      scheduledAt: new Date('2026-05-20T09:30').toISOString(),
    });
  });

  it('submits the vehicle assignment form payload', async () => {
    const user = userEvent.setup();
    renderApp('/operations/op-1/truck');

    await user.selectOptions(await screen.findByLabelText(/camion de catalogo/i), 'truck-1');
    await user.selectOptions(screen.getByLabelText(/acoplado/i), 'trailer-1');
    await user.type(screen.getByLabelText(/notas operativas/i), ' Con acoplado ');
    await user.click(screen.getByRole('button', { name: /asignar vehiculo/i }));

    await waitFor(() => expect(trucksApiMock.upsertAssignment).toHaveBeenCalledTimes(1));
    expect(trucksApiMock.upsertAssignment.mock.calls[0]?.[0]).toBe('op-1');
    expect(trucksApiMock.upsertAssignment.mock.calls[0]?.[1]).toEqual({
      truckCatalogId: 'truck-1',
      trailerCatalogId: 'trailer-1',
      notes: 'Con acoplado',
    });
  });

  it('submits the destination assignment form payload', async () => {
    const user = userEvent.setup();
    renderApp('/operations/op-1/destinations');

    await user.selectOptions(await screen.findByLabelText(/destino de catalogo/i), 'dest-1');
    await user.type(screen.getByLabelText(/notas de operacion/i), ' Primer punto ');
    await user.click(screen.getByRole('button', { name: /asignar destino/i }));

    await waitFor(() => expect(destinationsApiMock.createAssignment).toHaveBeenCalledTimes(1));
    expect(destinationsApiMock.createAssignment.mock.calls[0]?.[0]).toBe('op-1');
    expect(destinationsApiMock.createAssignment.mock.calls[0]?.[1]).toEqual({
      destinationCatalogId: 'dest-1',
      unloadingOrder: 2,
      notes: 'Primer punto',
    });
  });

  it('submits the product assignment form payload', async () => {
    const user = userEvent.setup();
    renderApp('/operations/op-1/products');

    await user.selectOptions(await screen.findByLabelText(/producto de catalogo/i), 'prod-1');
    await user.selectOptions(screen.getByLabelText(/^destino$/i), 'op-dest-1');
    await user.clear(screen.getByLabelText(/cantidad/i));
    await user.type(screen.getByLabelText(/cantidad/i), '3');
    await user.type(screen.getByLabelText(/peso override kg/i), '120.5');
    await user.type(screen.getByLabelText(/largo override mm/i), '2000');
    await user.click(screen.getByLabelText(/forzar apilable/i));
    await user.type(screen.getByLabelText(/notas operativas/i), ' Urgente ');
    await user.click(screen.getByRole('button', { name: /asignar producto/i }));

    await waitFor(() => expect(productsApiMock.createAssignment).toHaveBeenCalledTimes(1));
    expect(productsApiMock.createAssignment.mock.calls[0]?.[0]).toBe('op-1');
    expect(productsApiMock.createAssignment.mock.calls[0]?.[1]).toEqual({
      productCatalogId: 'prod-1',
      operationDestinationId: 'op-dest-1',
      quantity: 3,
      weightKgOverride: 120.5,
      lengthMmOverride: 2000,
      widthMmOverride: undefined,
      heightMmOverride: undefined,
      stackableOverride: true,
      rotationAllowedOverride: undefined,
      notes: 'Urgente',
    });
  });
});
