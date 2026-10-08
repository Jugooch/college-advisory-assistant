/**
 * @file Registers the plan drafts routes. Paths come from the shared contract.
 * @module @caa/api/modules/plan-drafts/plan-drafts.routes
 * @requirement FR-02
 * @requirement FR-11
 */
import type { FastifyInstance } from 'fastify';

import { savePlanEndpoint } from '@caa/api-contract';

import type { PlanDraftsController } from './plan-drafts.controller';

/**
 * Registers the save endpoint for plan drafts. Revalidation is in the plan revalidation module.
 * App-owned data only: no route writes to an institutional system.
 *
 * @param app - The authenticated route scope.
 * @param controller - The plan drafts handlers.
 */
export function registerPlanDraftsRoutes(
  app: FastifyInstance,
  controller: PlanDraftsController,
): void {
  app.route({
    method: savePlanEndpoint.method,
    url: savePlanEndpoint.path,
    handler: controller.savePlan,
  });
}
