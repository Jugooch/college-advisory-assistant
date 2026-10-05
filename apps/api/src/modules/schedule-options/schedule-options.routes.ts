/**
 * @file Registers the schedule options routes. Paths come from the shared contract.
 * @module @caa/api/modules/schedule-options/schedule-options.routes
 * @requirement FR-07
 * @requirement FR-10
 */
import type { FastifyInstance } from 'fastify';

import { findScheduleOptionsEndpoint } from '@caa/api-contract';

import type { ScheduleOptionsController } from './schedule-options.controller';

/**
 * Registers `POST /v1/students/:studentId/schedule-options`. Read-only: it registers nothing
 * and writes nothing to an institutional system.
 *
 * @param app - The authenticated route scope.
 * @param controller - The schedule options handlers.
 */
export function registerScheduleOptionsRoutes(
  app: FastifyInstance,
  controller: ScheduleOptionsController,
): void {
  app.route({
    method: findScheduleOptionsEndpoint.method,
    url: findScheduleOptionsEndpoint.path,
    handler: controller.findOptions,
  });
}
