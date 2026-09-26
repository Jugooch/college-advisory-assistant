/**
 * @file Typed HTTP client. The only code in the web app that performs network requests.
 * @module @caa/api-contract/client/create-api-client
 * @see docs/standards/05-api-design.md
 */
import type { z } from 'zod';

import type { EndpointDefinition } from '../define-endpoint';
import { SuccessEnvelopeSchema } from '../envelope';
import { ApiError } from './api-error';

/** Options for {@link createApiClient}. */
export interface ApiClientOptions {
  /** Base URL of the API, without a trailing slash. */
  readonly baseUrl: string;
  /** Returns headers added to every request, such as the session token. */
  readonly getHeaders?: () => Promise<Record<string, string>>;
  /** Fetch implementation. Tests inject a fake. */
  readonly fetchFn?: typeof fetch;
}

/** Calls API endpoints and returns validated response data. */
export interface ApiClient {
  call<TResponse extends z.ZodType>(
    endpoint: EndpointDefinition<TResponse>,
    body?: unknown,
  ): Promise<z.infer<TResponse>>;
}

/**
 * Creates a client that validates every response against the endpoint's contract.
 *
 * @param options - Base URL, optional header provider, and optional fetch implementation.
 * @returns An {@link ApiClient}.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchFn = options.fetchFn ?? fetch;

  return {
    async call(endpoint, body) {
      const headers = { 'content-type': 'application/json', ...(await options.getHeaders?.()) };
      const init: RequestInit = { method: endpoint.method, headers };
      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }

      const response = await fetchFn(`${options.baseUrl}${endpoint.path}`, init);
      const json: unknown = await response.json();
      if (!response.ok) {
        throw ApiError.fromResponseBody(json, response.status);
      }
      const envelope = SuccessEnvelopeSchema.parse(json);
      return endpoint.response.parse(envelope.data);
    },
  };
}
