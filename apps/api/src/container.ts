/**
 * @file Composition root. The only file that constructs repositories, services, and controllers.
 * @module @caa/api/container
 */
import type { ApiEnv } from './config/env';
import { createHealthController, type HealthController } from './modules/health/health.controller';
import { createHealthService } from './modules/health/health.service';

/** Every controller the app registers. */
export interface Controllers {
  readonly health: HealthController;
}

/**
 * Builds the dependency graph for the API.
 *
 * @param env - Validated configuration.
 * @returns The controllers, ready to register.
 */
export function createControllers(env: ApiEnv): Controllers {
  const healthService = createHealthService({ version: env.APP_VERSION, now: () => new Date() });
  return { health: createHealthController(healthService) };
}
