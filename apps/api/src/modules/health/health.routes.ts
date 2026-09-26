/**
 * @file Registers the health routes. Paths come from the shared contract.
 * @module @caa/api/modules/health/health.routes
 */
import type { FastifyInstance } from 'fastify';

import { getHealthEndpoint } from '@caa/api-contract';

import type { HealthController } from './health.controller';

/**
 * Registers every route in the health module.
 *
 * @param app - Fastify instance.
 * @param controller - Health controller.
 */
export function registerHealthRoutes(app: FastifyInstance, controller: HealthController): void {
  app.route({
    method: getHealthEndpoint.method,
    url: getHealthEndpoint.path,
    handler: controller.getHealth,
  });
}
