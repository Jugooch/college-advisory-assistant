/**
 * @file Endpoint definitions: the single source of truth for each route's method, path, and response.
 * @module @caa/api-contract/define-endpoint
 * @see docs/standards/05-api-design.md
 */
import type { z } from 'zod';

/** HTTP methods the API uses. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Versioned route path. Segments starting with `:` are path params, for example
 * `/v1/students/:studentId`. Fastify uses the same syntax, so the server registers the path as-is.
 */
export type EndpointPath = `/v1/${string}`;

/**
 * Names of the `:params` in a path literal, as a union. `never` when the path has none.
 *
 * @example PathParamName<'/v1/plans/:planId/sections/:sectionId'> is 'planId' | 'sectionId'
 */
export type PathParamName<TPath extends string> =
  TPath extends `${string}:${infer Param}/${infer Rest}`
    ? Param | PathParamName<`/${Rest}`>
    : TPath extends `${string}:${infer Param}`
      ? Param
      : never;

/** Values for every `:param` in a path, keyed by param name. Values are URL-encoded when sent. */
export type PathParams<TPath extends string> = Readonly<Record<PathParamName<TPath>, string>>;

/** Describes one API route. Both the server and the client read this object. */
export interface EndpointDefinition<
  TResponse extends z.ZodType,
  TPath extends EndpointPath = EndpointPath,
> {
  readonly method: HttpMethod;
  readonly path: TPath;
  readonly response: TResponse;
}

/**
 * Declares an endpoint. Returns its input unchanged but locks in the literal types, including the
 * path literal so callers get its param names.
 *
 * @param definition - Method, versioned path, and response schema.
 * @returns The same definition.
 */
export function defineEndpoint<TResponse extends z.ZodType, const TPath extends EndpointPath>(
  definition: EndpointDefinition<TResponse, TPath>,
): EndpointDefinition<TResponse, TPath> {
  return definition;
}
