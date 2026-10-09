import type {
  EventCentralRecord,
  EventChoiceResult,
  EventChoiceSimulation,
  EventExchangeCentralRecord,
  EventExchangeResult,
  EventExchangeSimulation,
  EventMinutes,
  EventOperationalMovement,
  EventPreparationRecord,
  EventRecord,
  PaginatedResponse,
  PublicEventChoice,
  PublicEventDisplay,
  WorkPositionRecord,
} from '@seduc/contracts';

import type { ValidationIssue } from './form-errors';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class EventHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues: ValidationIssue[] = [],
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
      issues?: unknown;
      message?: unknown;
    } | null;
    throw new EventHttpError(
      response.status,
      typeof body?.error === 'string' ? body.error : 'EVENT_REQUEST_FAILED',
      typeof body?.message === 'string' ? body.message : 'Não foi possível concluir a solicitação.',
      Array.isArray(body?.issues) ? (body.issues as ValidationIssue[]) : [],
    );
  }
  return (await response.json()) as T;
}

export const eventApi = {
  central(id: string) {
    return request<EventCentralRecord>(`/eventos/${id}/central`);
  },
  choose(id: string, body: { participanteEsperadoId: string; postoTrabalhoId: string }) {
    return request<EventChoiceResult>(`/eventos/${id}/escolha`, {
      body: JSON.stringify(body),
      method: 'POST',
    });
  },
  close(id: string) {
    return request<EventRecord>(`/eventos/${id}/encerrar`, { method: 'POST' });
  },
  create(body: unknown) {
    return request<EventRecord>('/eventos', { body: JSON.stringify(body), method: 'POST' });
  },
  delete(id: string, senhaAtual: string) {
    return request<void>(`/eventos/${id}`, {
      body: JSON.stringify({ senhaAtual }),
      method: 'DELETE',
    });
  },
  getPreparation(id: string) {
    return request<EventPreparationRecord>(`/eventos/${id}/preparacao`);
  },
  minutes(id: string) {
    return request<EventMinutes>(`/eventos/${id}/ata`);
  },
  list(page = 1) {
    return request<PaginatedResponse<EventRecord>>(`/eventos?page=${page}&pageSize=20`);
  },
  exchangeCentral(id: string) {
    return request<EventExchangeCentralRecord>(`/eventos/${id}/permuta`);
  },
  confirmExchange(
    id: string,
    body: {
      participanteEsperadoId: string;
      postoOrigemAtualEsperadoId: string;
      postoOrigemSegundoEsperadoId: string;
      segundoParticipanteId: string;
    },
  ) {
    return request<EventExchangeResult>(`/eventos/${id}/confirmar-permuta`, {
      body: JSON.stringify(body),
      method: 'POST',
    });
  },
  movements(id: string, page = 1, pageSize = 20) {
    return request<PaginatedResponse<EventOperationalMovement>>(
      `/eventos/${id}/movimentacoes?page=${page}&pageSize=${pageSize}`,
    );
  },
  publicChoices(id: string, page = 1, pageSize = 20) {
    return request<PaginatedResponse<PublicEventChoice>>(
      `/public/eventos/${id}/escolhas?page=${page}&pageSize=${pageSize}`,
    );
  },
  publicDisplay(id: string) {
    return request<PublicEventDisplay>(`/public/eventos/${id}/telao`);
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
  simulate(id: string, postoTrabalhoId: string) {
    return request<EventChoiceSimulation>(
      `/eventos/${id}/simular-escolha?postoTrabalhoId=${encodeURIComponent(postoTrabalhoId)}`,
    );
  },
  simulateExchange(id: string, segundoParticipanteId: string) {
    return request<EventExchangeSimulation>(
      `/eventos/${id}/simular-permuta?segundoParticipanteId=${encodeURIComponent(segundoParticipanteId)}`,
    );
  },
  update(id: string, body: unknown) {
    return request<EventRecord>(`/eventos/${id}`, {
      body: JSON.stringify(body),
      method: 'PATCH',
    });
  },
  vacancies(
    id: string,
    filters: { periodoId?: string; tipo?: 'SEDE' | 'SEM_SEDE'; unidadeId?: string },
  ) {
    const query = new URLSearchParams();
    if (filters.periodoId) query.set('periodoId', filters.periodoId);
    if (filters.tipo) query.set('tipo', filters.tipo);
    if (filters.unidadeId) query.set('unidadeId', filters.unidadeId);
    const suffix = query.size ? `?${query.toString()}` : '';
    return request<WorkPositionRecord[]>(`/eventos/${id}/vagas${suffix}`);
  },
};
