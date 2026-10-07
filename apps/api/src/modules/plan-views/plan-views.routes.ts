/**
 * @file Registers the plan read routes. Paths come from the shared contract.
 * @module @caa/api/modules/plan-views/plan-views.routes
 * @requirement FR-02
 * @requirement FR-11
 */
import type { FastifyInstance } from 'fastify';

import { getPlanEndpoint, getPlanRevisionEndpoint, listPlansEndpoint } from '@caa/api-contract';

import type { PlanViewsController } from './plan-views.controller';

/**
 * Registers the list, read, and read-a-revision endpoints. Read-only: nothing is written.
 *
 * @param app - The authenticated route scope.
 * @param controller - The plan read handlers.
 */
export function registerPlanViewsRoutes(
  app: FastifyInstance,
  controller: PlanViewsController,
): void {
  app.route({
    method: listPlansEndpoint.method,
    url: listPlansEndpoint.path,
    handler: controller.listPlans,
  });
  app.route({
    method: getPlanEndpoint.method,
    url: getPlanEndpoint.path,
    handler: controller.getPlan,
  });
  app.route({
    method: getPlanRevisionEndpoint.method,
    url: getPlanRevisionEndpoint.path,
    handler: controller.getPlanRevision,
  });
}
