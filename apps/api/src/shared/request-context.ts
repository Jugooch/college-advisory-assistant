/**
 * @file Request-scoped values that controllers build from the request and pass to services.
 * @module @caa/api/shared/request-context
 * @see docs/standards/05-api-design.md
 */
import type { Logger } from './logger';

/**
 * Per-request values a service method receives as its final `context` parameter. Built by the
 * controller; new request-scoped values are added here, never as extra parameters.
 */
export interface RequestContext {
  /** Fastify's `request.log`, so every line the service writes carries the request ID. */
  readonly logger: Logger;
}
