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

/** Path and body options, with `params` required exactly when the path has `:params`. */
type BaseOptions<TPath extends string> = [PathParamName<TPath>] extends [never]
  ? { readonly body?: unknown }
  : { readonly params: PathParams<TPath>; readonly body?: unknown };

/**
 * Per-call options. `query` is typed from the endpoint's query schema (its input, so values are
 * what the query string carries); endpoints without a query schema accept none.
 */
export type CallOptions<
  TPath extends string,
  TQuery extends z.ZodType | undefined = undefined,
> = TQuery extends z.ZodType
  ? BaseOptions<TPath> & { readonly query?: z.input<TQuery> }
  : BaseOptions<TPath>;

/** Arguments after the endpoint. Options may be omitted only when the path has no `:params`. */
export type CallArgs<TPath extends string, TQuery extends z.ZodType | undefined = undefined> = [
  PathParamName<TPath>,
] extends [never]
  ? [options?: CallOptions<TPath, TQuery>]
  : [options: CallOptions<TPath, TQuery>];

/** Calls API endpoints and returns validated response data. */
export interface ApiClient {
  /**
   * Calls an endpoint and validates the response against its contract.
   *
   * @param endpoint - Endpoint definition from a contract file.
   * @param args - Optional `{ params, query, body }`. `params` fills the path's `:params`;
   *   `query` is validated with the endpoint's query schema and sent in the query string;
   *   `body` is sent as JSON.
   * @returns The validated `data` payload.
   * @throws {MissingPathParamError} When a path param has no value. No request is sent.
   * @throws {z.ZodError} When `query` fails the endpoint's query schema. No request is sent.
   * @throws {TypeError} When `query` is given to an endpoint with no query schema, or a query value
   *   is not a string, number, or boolean. No request is sent.
   * @throws {ApiError} When the API returns an error envelope.
   */
  call<
    TResponse extends z.ZodType,
    TPath extends EndpointPath,
    TQuery extends z.ZodType | undefined = undefined,
  >(
    endpoint: EndpointDefinition<TResponse, TPath, TQuery>,
    ...args: CallArgs<TPath, TQuery>
  ): Promise<z.infer<TResponse>>;
}

/** Call options with the path-specific typing erased, for the untyped request step. */
interface RequestOptions {
  readonly params?: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, unknown>> | undefined;
  readonly body?: unknown;
}

/**
 * Validates a query with the endpoint's schema and encodes it for the URL.
 *
 * @param schema - The endpoint's query schema, if it has one.
 * @param query - Query values from the caller.
 * @returns `''` for no query, otherwise `?` plus the encoded pairs. Undefined values are omitted.
 * @throws {z.ZodError} When the query fails the schema.
 * @throws {TypeError} When a query is given to an endpoint with no query schema, or a value is not
 *   a string, number, or boolean.
 */
function encodeQuery(
  schema: z.ZodType | undefined,
  query: Readonly<Record<string, unknown>> | undefined,
): string {
  if (query === undefined) {
    return '';
  }
  if (schema === undefined) {
    throw new TypeError('This endpoint takes no query');
  }
  schema.parse(query);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      throw new TypeError(`Query value "${key}" must be a string, number, or boolean`);
    }
    search.set(key, String(value));
  }
  const text = search.toString();
  return text === '' ? '' : `?${text}`;
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
    endpoint: EndpointDefinition<TResponse, EndpointPath, z.ZodType | undefined>,
    request: RequestOptions,
  ): Promise<z.infer<TResponse>> => {
    const path = buildPath(endpoint.path, request.params ?? {});
    const url = `${options.baseUrl}${path}${encodeQuery(endpoint.query, request.query)}`;
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
