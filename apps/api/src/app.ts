/**
 * @file Builds the Fastify application without starting it, so tests can use `inject`.
 * @module @caa/api/app
 */
import Fastify, { type FastifyInstance } from 'fastify';

import type { Controllers } from './container';
import { registerHealthRoutes } from './modules/health/health.routes';
import { registerErrorHandler } from './plugins/error-handler.plugin';

/** Options for {@link buildApp}. */
export interface BuildAppOptions {
  readonly controllers: Controllers;
  readonly isLoggerEnabled: boolean;
}

/**
 * Creates the configured Fastify instance.
 *
 * @param options - Controllers and logger setting.
 * @returns The Fastify instance, not yet listening.
 */
export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({ logger: options.isLoggerEnabled });
  registerErrorHandler(app);
  registerHealthRoutes(app, options.controllers.health);
  return app;
}
