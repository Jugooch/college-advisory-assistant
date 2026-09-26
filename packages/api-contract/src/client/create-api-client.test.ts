/**
 * @file Tests for the typed API client.
 */
import { ErrorCode } from '@caa/domain';
import { describe, expect, it } from 'vitest';

import { getHealthEndpoint } from '../contracts/health.contract';
import { ApiError } from './api-error';
import { createApiClient } from './create-api-client';

/**
 * Builds a fetch stub that always answers with the given status and body.
 *
 * @param status - HTTP status to return.
 * @param body - JSON body to return.
 * @returns A fetch-compatible function.
 */
function stubFetch(status: number, body: unknown): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status });
}

describe('createApiClient', () => {
  it('returns the validated data payload on success', async () => {
    const data = { status: 'ok', version: '0.0.0', checkedAt: '2026-09-25T12:00:00.000Z' };
    const client = createApiClient({ baseUrl: 'http://api', fetchFn: stubFetch(200, { data }) });

    await expect(client.call(getHealthEndpoint)).resolves.toEqual(data);
  });

  it('throws an ApiError carrying the server error code', async () => {
    const error = { code: ErrorCode.StaleSource, message: 'Stale', requestId: 'req-1' };
    const client = createApiClient({ baseUrl: 'http://api', fetchFn: stubFetch(409, { error }) });

    await expect(client.call(getHealthEndpoint)).rejects.toMatchObject({
      code: ErrorCode.StaleSource,
      requestId: 'req-1',
    });
  });

  it('rejects a success body that breaks the contract', async () => {
    const client = createApiClient({
      baseUrl: 'http://api',
      fetchFn: stubFetch(200, { data: {} }),
    });

    await expect(client.call(getHealthEndpoint)).rejects.not.toBeInstanceOf(ApiError);
  });
});
