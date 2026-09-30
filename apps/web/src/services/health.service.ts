import type { HealthResponse } from '@seduc/contracts';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

export async function getApiReadiness(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${apiBaseUrl}/health/ready`, {
    headers: { Accept: 'application/json' },
    ...(signal ? { signal } : {}),
  });

  const body = (await response.json()) as HealthResponse;

  if (!response.ok) {
    throw new Error(`API indisponível: ${body.status}`);
  }

  return body;
}
