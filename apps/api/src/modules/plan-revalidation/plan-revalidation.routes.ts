/**
 * @file Registers the plan revalidation route. The path comes from the shared contract.
 * @module @caa/api/modules/plan-revalidation/plan-revalidation.routes
 * @requirement FR-02
 * @requirement FR-11
 */
import type { FastifyInstance } from 'fastify';

import { revalidatePlanEndpoint } from '@caa/api-contract';

import type { PlanRevalidationController } from './plan-revalidation.controller';

/**
 * Registers the revalidate endpoint for plan drafts.
 * App-owned data only: no route writes to an institutional system.
 *
 * @param app - The authenticated route scope.
 * @param controller - The plan revalidation handlers.
 */
export function registerPlanRevalidationRoutes(
  app: FastifyInstance,
  controller: PlanRevalidationController,
): void {
  app.route({
    method: revalidatePlanEndpoint.method,
    url: revalidatePlanEndpoint.path,
    handler: controller.revalidatePlan,
  });
}
