import { describe, expect, it, vi } from 'vitest';

import { getApiReadiness } from '@/services/health.service';

describe('getApiReadiness', () => {
  it('retorna o estado de prontidão da API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            checks: { database: 'up' },
            service: 'seduc-api',
            status: 'ready',
            timestamp: '2026-09-30T15:00:00.000Z',
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(getApiReadiness()).resolves.toMatchObject({ status: 'ready' });
  });

  it('sinaliza indisponibilidade quando o readiness falha', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            checks: { database: 'down' },
            service: 'seduc-api',
            status: 'unavailable',
            timestamp: '2026-09-30T15:00:00.000Z',
          }),
          { status: 503 },
        ),
      ),
    );

    await expect(getApiReadiness()).rejects.toThrow('API indisponível');
  });
});
