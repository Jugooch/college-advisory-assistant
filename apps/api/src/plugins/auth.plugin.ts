/**
 * @file Authenticates requests from the bearer token and attaches the resolved actor to the request.
 * @module @caa/api/plugins/auth
 * @requirement FR-01
 * @see docs/standards/09-errors-logging-and-security.md
 * @see docs/planning/12-security-privacy-and-procurement.md
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';

import type { Actor } from '@caa/domain';

import type { SessionResolver } from '../modules/session/session.service';
import { UnauthorizedError } from '../shared/domain-errors';

declare module 'fastify' {
  interface FastifyRequest {
    /** Actor resolved from the bearer token. Null outside the authenticated scope. */
    actor: Actor | null;
  }
}

/** `Authorization: Bearer <token>`, case-insensitive scheme, one token with no spaces. */
const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

/** Options for {@link registerAuthenticatedScope}. */
export interface AuthenticatedScopeOptions {
  readonly sessionResolver: SessionResolver;
  /** Registers the routes that require a signed-in actor. */
  readonly registerRoutes: (scope: FastifyInstance) => void;
}

/**
 * Reads the bearer token from the `Authorization` header.
 *
 * @param request - Incoming request.
 * @returns The token, or null when the header is missing or not a bearer token.
 */
function readBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  return header === undefined ? null : (BEARER_PATTERN.exec(header)?.[1] ?? null);
}

/**
 * Registers routes in a scope where every request must resolve to an actor, or fail with 401.
 * Routes registered outside the scope, like health, stay public.
 *
 * @param app - Root Fastify instance.
 * @param options - Session resolver and the protected routes.
 */
export function registerAuthenticatedScope(
  app: FastifyInstance,
  options: AuthenticatedScopeOptions,
): void {
  app.decorateRequest('actor', null);
  void app.register((scope, _pluginOptions, done) => {
    scope.addHook('onRequest', async (request) => {
      // SECURITY: the actor comes only from the bearer token through the session resolver. Tenant,
      // user, and role are never read from the body, the query, or any other header.
      const token = readBearerToken(request);
      const actor = token === null ? null : await options.sessionResolver.resolve(token);
      if (actor === null) {
        request.log.info({ hasToken: token !== null }, 'authentication failed');
        throw new UnauthorizedError();
      }
      request.actor = actor;
    });
    options.registerRoutes(scope);
    done();
  });
}

/**
 * Returns the authenticated actor for a request in the authenticated scope.
 *
 * @param request - Incoming request.
 * @returns The actor set by the auth hook.
 * @throws {UnauthorizedError} When no actor is set, for example on a route outside the scope.
 */
export function requireActor(request: FastifyRequest): Actor {
  if (request.actor === null) {
    throw new UnauthorizedError();
  }
  return request.actor;
}
