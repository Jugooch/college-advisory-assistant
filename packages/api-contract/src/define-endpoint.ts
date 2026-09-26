/**
 * @file Endpoint definitions: the single source of truth for each route's method, path, and response.
 * @module @caa/api-contract/define-endpoint
 * @see docs/standards/05-api-design.md
 */
import type { z } from 'zod';

/** HTTP methods the API uses. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Describes one API route. Both the server and the client read this object. */
export interface EndpointDefinition<TResponse extends z.ZodType> {
  readonly method: HttpMethod;
  readonly path: `/v1/${string}`;
  readonly response: TResponse;
}

/**
 * Declares an endpoint. Returns its input unchanged but locks in the literal types.
 *
 * @param definition - Method, versioned path, and response schema.
 * @returns The same definition.
 */
export function defineEndpoint<TResponse extends z.ZodType>(
  definition: EndpointDefinition<TResponse>,
): EndpointDefinition<TResponse> {
  return definition;
}
