import type {
  AdministrativeCorrectionPreview,
  AuditRecord,
  PaginatedResponse,
} from '@seduc/contracts';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
    throw new Error(
      typeof body?.message === 'string' ? body.message : 'Não foi possível concluir a solicitação.',
    );
  }
  return (await response.json()) as T;
}

function queryString(input: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

export const auditApi = {
  applyCorrection(body: unknown) {
    return request<AdministrativeCorrectionPreview>('/correcao-administrativa/aplicar', {
      body: JSON.stringify(body),
      method: 'POST',
    });
  },
  list(filters: Record<string, unknown>) {
    return request<PaginatedResponse<AuditRecord>>(`/auditoria${queryString(filters)}`);
  },
  previewCorrection(body: unknown) {
    return request<AdministrativeCorrectionPreview>('/correcao-administrativa/previsualizar', {
      body: JSON.stringify(body),
      method: 'POST',
    });
  },
};
