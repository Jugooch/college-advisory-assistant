/**
 * @file Tests for the policy search call: the query reaches the typed client as URL parameters.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { searchPolicies } from './policies.api';

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn<(url: string) => Promise<Response>>(),
}));

// NOTE: swaps the session-cookie client for a real one with a stubbed `fetch`.
vi.mock('@/lib/api-client', async () => {
  const { createApiClient } = await import('@caa/api-contract');
  return {
    apiClient: createApiClient({
      baseUrl: 'http://api.test',
      getHeaders: () => Promise.resolve({}),
      fetchFn: fetchMock as unknown as typeof fetch,
    }),
  };
});

describe('searchPolicies', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(
      Response.json({ data: { hits: [], asOf: '2026-10-08T12:00:00.000Z' } }),
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('sends the search text', async () => {
    const result = await searchPolicies({ q: 'late drop' });

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://api.test/v1/policies?q=late+drop');
    expect(result.hits).toEqual([]);
  });

  it('sends the topic', async () => {
    await searchPolicies({ topic: 'CRISIS' });

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://api.test/v1/policies?topic=CRISIS');
  });
});
