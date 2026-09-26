/**
 * @file Typed HTTP client. The only code in the web app that performs network requests.
 * @module @caa/api-contract/client/create-api-client
 * @see docs/standards/05-api-design.md
 */
import type { z } from 'zod';

import type {
  EndpointDefinition,
  EndpointPath,
  PathParamName,
  PathParams,
} from '../define-endpoint';
import { SuccessEnvelopeSchema } from '../envelope';
import { ApiError } from './api-error';
import { buildPath } from './build-path';

/** Options for {@link createApiClient}. */
export interface ApiClientOptions {
  /** Base URL of the API, without a trailing slash. */
  readonly baseUrl: string;
  /** Returns headers added to every request, such as the session token. */
  readonly getHeaders?: () => Promise<Record<string, string>>;
  /** Fetch implementation. Tests inject a fake. */
  readonly fetchFn?: typeof fetch;
}

/** Per-call options. `params` is required exactly when the endpoint path has `:params`. */
export type CallOptions<TPath extends string> = [PathParamName<TPath>] extends [never]
  ? { readonly body?: unknown }
  : { readonly params: PathParams<TPath>; readonly body?: unknown };

/** Arguments after the endpoint. Options may be omitted only when the path has no `:params`. */
export type CallArgs<TPath extends string> = [PathParamName<TPath>] extends [never]
  ? [options?: CallOptions<TPath>]
  : [options: CallOptions<TPath>];

/** Calls API endpoints and returns validated response data. */
export interface ApiClient {
  /**
   * Calls an endpoint and validates the response against its contract.
   *
   * @param endpoint - Endpoint definition from a contract file.
   * @param args - Optional `{ params, body }`. `params` fills the path's `:params`; `body` is sent as JSON.
   * @returns The validated `data` payload.
   * @throws {MissingPathParamError} When a path param has no value. No request is sent.
   * @throws {ApiError} When the API returns an error envelope.
   */
  call<TResponse extends z.ZodType, TPath extends EndpointPath>(
    endpoint: EndpointDefinition<TResponse, TPath>,
    ...args: CallArgs<TPath>
  ): Promise<z.infer<TResponse>>;
}

/** Call options with the path-specific typing erased, for the untyped request step. */
interface RequestOptions {
  readonly params?: Readonly<Record<string, string>>;
  readonly body?: unknown;
}

/**
 * Creates a client that validates every response against the endpoint's contract.
 *
 * @param options - Base URL, optional header provider, and optional fetch implementation.
 * @returns An {@link ApiClient}.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchFn = options.fetchFn ?? fetch;

  const send = async <TResponse extends z.ZodType>(
    endpoint: EndpointDefinition<TResponse>,
    request: RequestOptions,
  ): Promise<z.infer<TResponse>> => {
    const url = `${options.baseUrl}${buildPath(endpoint.path, request.params ?? {})}`;
    const headers = { 'content-type': 'application/json', ...(await options.getHeaders?.()) };
    const init: RequestInit = { method: endpoint.method, headers };
    if (request.body !== undefined) {
      init.body = JSON.stringify(request.body);
    }

    const response = await fetchFn(url, init);
    const json: unknown = await response.json();
    if (!response.ok) {
      throw ApiError.fromResponseBody(json, response.status);
    }
    const envelope = SuccessEnvelopeSchema.parse(json);
    return endpoint.response.parse(envelope.data);
  };

  return {
    async call(endpoint, ...args) {
      const [callOptions] = args;
      const request: RequestOptions = callOptions ?? {};
      return send(endpoint, request);
    },
  };
}
