/**
 * @file Tests for the advisor queue call: the filters ride on the path as a query string and
 * nothing else is added.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listAdvisorCases } from './cases.api';

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn<(url: string) => Promise<Response>>(),
}));

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

/**
 * Reads the URL the last request used.
 *
 * @returns The full request URL.
 */
function lastUrl(): string {
  return String(fetchMock.mock.calls[0]?.[0]);
}

describe('listAdvisorCases', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  beforeEach(() => {
    fetchMock.mockResolvedValue(Response.json({ data: { cases: [] } }));
  });

  it('sends no query for every case', async () => {
    await listAdvisorCases();

    expect(lastUrl()).toBe('http://api.test/v1/advisor/cases');
  });

  it('sends the status', async () => {
    await listAdvisorCases({ status: 'IN_REVIEW' });

    expect(lastUrl()).toBe('http://api.test/v1/advisor/cases?status=IN_REVIEW');
  });

  it('sends the unrouted flag as true', async () => {
    await listAdvisorCases({ unrouted: true });

    expect(lastUrl()).toBe('http://api.test/v1/advisor/cases?unrouted=true');
  });

  it('sends the unrouted flag as false', async () => {
    await listAdvisorCases({ unrouted: false });

    expect(lastUrl()).toBe('http://api.test/v1/advisor/cases?unrouted=false');
  });

  it('sends both filters together', async () => {
    await listAdvisorCases({ status: 'IN_REVIEW', unrouted: true });

    expect(lastUrl()).toBe('http://api.test/v1/advisor/cases?status=IN_REVIEW&unrouted=true');
  });
});
