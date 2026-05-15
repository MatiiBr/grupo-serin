import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.mock('./api/operations', () => ({
  operationsApi: {
    list: vi.fn(async () => []),
    get: vi.fn(),
    create: vi.fn(),
  },
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
  it('renders the operations route', async () => {
    renderApp('/operations');

    expect(await screen.findByRole('heading', { name: /nueva operacion/i })).toBeInTheDocument();
  });

  it('renders the not-found route', () => {
    renderApp('/ruta-inexistente');

    expect(screen.getByText(/ruta no encontrada/i)).toBeInTheDocument();
  });
});
