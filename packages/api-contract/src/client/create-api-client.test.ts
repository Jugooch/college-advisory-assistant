/**
 * @file Tests for the typed API client.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';

import { ErrorCode } from '@caa/domain';

import { getHealthEndpoint } from '../contracts/health.contract';
import { getStudentEndpoint } from '../contracts/students.contract';
import { defineEndpoint } from '../define-endpoint';
import { ApiError } from './api-error';
import { MissingPathParamError } from './build-path';
import { type CallArgs, createApiClient } from './create-api-client';

const STUDENT = { id: '2b3c4d5e-0000-4000-8000-000000000001', sourceStudentId: 'DEMO-S-0001' };

/** One request the recording fetch stub received. */
interface RecordedRequest {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

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

/**
 * Builds a fetch stub that records each request and answers with a success envelope.
 *
 * @param data - Payload to wrap in `{ data }`.
 * @returns The fetch function and the list of requests it received.
 */
function recordingFetch(data: unknown): {
  fetchFn: typeof fetch;
  requests: RecordedRequest[];
} {
  const requests: RecordedRequest[] = [];
  const fetchFn: typeof fetch = async (input, init) => {
    requests.push({ url: input instanceof Request ? input.url : input.toString(), init });
    return new Response(JSON.stringify({ data }), { status: 200 });
  };
  return { fetchFn, requests };
}

describe('createApiClient', () => {
  it('returns the validated data payload on success', async () => {
    const data = {
      status: 'ok',
      version: '0.0.0',
      checkedAt: '2026-09-25T12:00:00.000Z',
      authMode: 'none',
    };
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

  it('fills path params into the request URL', async () => {
    const { fetchFn, requests } = recordingFetch(STUDENT);
    const client = createApiClient({ baseUrl: 'http://api', fetchFn });

    await expect(
      client.call(getStudentEndpoint, { params: { studentId: STUDENT.id } }),
    ).resolves.toEqual(STUDENT);
    expect(requests.map((request) => request.url)).toEqual([
      `http://api/v1/students/${STUDENT.id}`,
    ]);
  });

  it('URL-encodes path param values', async () => {
    const { fetchFn, requests } = recordingFetch(STUDENT);
    const client = createApiClient({ baseUrl: 'http://api', fetchFn });

    await client.call(getStudentEndpoint, { params: { studentId: 'DEMO/S 01' } });

    expect(requests[0]?.url).toBe('http://api/v1/students/DEMO%2FS%2001');
  });

  it('throws before sending any request when a path param is missing', async () => {
    const { fetchFn, requests } = recordingFetch(STUDENT);
    const client = createApiClient({ baseUrl: 'http://api', fetchFn });

    // @ts-expect-error -- the compiler also rejects a params object without studentId.
    const call = client.call(getStudentEndpoint, { params: {} });

    await expect(call).rejects.toBeInstanceOf(MissingPathParamError);
    expect(requests).toEqual([]);
  });

  it('throws before sending any request when params are omitted entirely', async () => {
    const { fetchFn, requests } = recordingFetch(STUDENT);
    const client = createApiClient({ baseUrl: 'http://api', fetchFn });

    // @ts-expect-error -- the compiler also rejects a call without params for this endpoint.
    const call = client.call(getStudentEndpoint);

    await expect(call).rejects.toBeInstanceOf(MissingPathParamError);
    expect(requests).toEqual([]);
  });

  it('sends the body as JSON when one is given', async () => {
    const { fetchFn, requests } = recordingFetch(STUDENT);
    const client = createApiClient({ baseUrl: 'http://api', fetchFn });
    const endpoint = defineEndpoint({
      method: 'POST',
      path: '/v1/students/:studentId/notes',
      response: getStudentEndpoint.response,
    });

    await client.call(endpoint, { params: { studentId: STUDENT.id }, body: { text: 'Demo' } });

    expect(requests[0]?.init).toMatchObject({ method: 'POST', body: '{"text":"Demo"}' });
  });

  it('requires params at compile time only for endpoints whose path has them', () => {
    expectTypeOf<CallArgs<'/v1/health'>>().toEqualTypeOf<[options?: { readonly body?: unknown }]>();
    expectTypeOf<CallArgs<'/v1/students/:studentId'>>().toEqualTypeOf<
      [
        options: {
          readonly params: Readonly<Record<'studentId', string>>;
          readonly body?: unknown;
        },
      ]
    >();
  });
});
