import type { HealthResponse } from '@restaurante/contracts';
export function createApiClient(baseUrl: string) {
  const base = baseUrl.replace(/\/$/, '');
  return {
    async health(): Promise<HealthResponse> {
      const response = await fetch(base + '/health', { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('Não foi possível acessar o servidor.');
      return response.json() as Promise<HealthResponse>;
    }
  };
}

