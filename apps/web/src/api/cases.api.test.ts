/**
 * @file Tests for the advisor queue call: the filters ride on the path as a query string and
 * nothing else is added.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { listAdvisorCases } from './cases.api';

const { call } = vi.hoisted(() => ({
  call: vi.fn<(endpoint: { path: string }) => Promise<unknown>>(),
}));

vi.mock('@/lib/api-client', () => ({ apiClient: { call } }));

/**
 * Reads the path the last call used.
 *
 * @returns The endpoint path.
 */
function lastPath(): string {
  return call.mock.calls[0]?.[0].path ?? '';
}

describe('listAdvisorCases', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('sends no query for every case', async () => {
    await listAdvisorCases();

    expect(lastPath()).toBe('/v1/advisor/cases');
  });

  it('sends the status', async () => {
    await listAdvisorCases({ status: 'IN_REVIEW' });

    expect(lastPath()).toBe('/v1/advisor/cases?status=IN_REVIEW');
  });

  it('sends the unrouted flag as true', async () => {
    await listAdvisorCases({ unrouted: true });

    expect(lastPath()).toBe('/v1/advisor/cases?unrouted=true');
  });
});
