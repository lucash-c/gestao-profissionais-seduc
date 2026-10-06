import type { EventPreparationRecord, EventRecord, PaginatedResponse } from '@seduc/contracts';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class EventHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'EventHttpError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: unknown;
      message?: unknown;
    } | null;
    throw new EventHttpError(
      response.status,
      typeof body?.error === 'string' ? body.error : 'EVENT_REQUEST_FAILED',
      typeof body?.message === 'string' ? body.message : 'Não foi possível concluir a solicitação.',
    );
  }
  return (await response.json()) as T;
}

export const eventApi = {
  create(body: unknown) {
    return request<EventRecord>('/eventos', { body: JSON.stringify(body), method: 'POST' });
  },
  getPreparation(id: string) {
    return request<EventPreparationRecord>(`/eventos/${id}/preparacao`);
  },
  list(page = 1) {
    return request<PaginatedResponse<EventRecord>>(`/eventos?page=${page}&pageSize=20`);
  },
  savePreparation(id: string, profissionalIds: string[]) {
    return request<EventPreparationRecord>(`/eventos/${id}/preparacao`, {
      body: JSON.stringify({ profissionalIds }),
      method: 'PUT',
    });
  },
  start(id: string) {
    return request<EventPreparationRecord>(`/eventos/${id}/iniciar`, { method: 'POST' });
  },
  update(id: string, body: unknown) {
    return request<EventRecord>(`/eventos/${id}`, {
      body: JSON.stringify(body),
      method: 'PATCH',
    });
  },
};
