export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type RequestOptions = RequestInit & { allowNotFound?: boolean };

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { allowNotFound, headers, ...init } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (allowNotFound && response.status === 404) {
    return null as T;
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw new ApiError(message ?? `Request failed with status ${response.status}`, response.status);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export function jsonBody(payload: unknown) {
  return JSON.stringify(payload);
}
