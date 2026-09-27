/**
 * @file Builds the Fastify application without starting it, so tests can use `inject`.
 * @module @caa/api/app
 */
import Fastify, { type FastifyInstance } from 'fastify';

import type { AppDependencies } from './container';
import { registerHealthRoutes } from './modules/health/health.routes';
import { registerSessionRoutes } from './modules/session/session.routes';
import { registerStudentsRoutes } from './modules/students/students.routes';
import { registerAuthenticatedScope } from './plugins/auth.plugin';
import { registerErrorHandler } from './plugins/error-handler.plugin';
import type { LogDestination } from './shared/logger';

/** Options for {@link buildApp}. */
export interface BuildAppOptions {
  readonly dependencies: AppDependencies;
  /** False disables logging; `{ stream }` writes JSON lines to the given destination. */
  readonly logger: boolean | { readonly stream: LogDestination };
}

/**
 * Creates the configured Fastify instance. Health is public; every other route needs a session.
 *
 * @param options - Dependencies and logger setting.
 * @returns The Fastify instance, not yet listening.
 */
export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger });
  const { controllers, sessionResolver } = options.dependencies;
  registerErrorHandler(app);
  registerHealthRoutes(app, controllers.health);
  registerAuthenticatedScope(app, {
    sessionResolver,
    registerRoutes: (scope) => {
      registerSessionRoutes(scope, controllers.session);
      registerStudentsRoutes(scope, controllers.students);
    },
  });
  return app;
}
