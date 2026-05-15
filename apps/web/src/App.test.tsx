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

vi.mock('./api/operations', () => ({
  operationsApi: operationsApiMock,
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
  });

  it('renders the operations route', async () => {
    renderApp('/operations');

    expect(await screen.findByRole('heading', { name: /nueva operacion/i })).toBeInTheDocument();
  });

  it('renders the not-found route', () => {
    renderApp('/ruta-inexistente');

    expect(screen.getByText(/ruta no encontrada/i)).toBeInTheDocument();
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
});
