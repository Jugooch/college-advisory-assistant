/**
 * @file Registers the plannable terms routes. Paths come from the shared contract.
 * @module @caa/api/modules/plannable-terms/plannable-terms.routes
 * @requirement FR-08
 */
import type { FastifyInstance } from 'fastify';

import { getPlannableTermsEndpoint } from '@caa/api-contract';

import type { PlannableTermsController } from './plannable-terms.controller';

/**
 * Registers `GET /v1/students/:studentId/plannable-terms`. Read-only: it writes nothing to an
 * institutional system.
 *
 * @param app - The authenticated route scope.
 * @param controller - The plannable terms handlers.
 */
export function registerPlannableTermsRoutes(
  app: FastifyInstance,
  controller: PlannableTermsController,
): void {
  app.route({
    method: getPlannableTermsEndpoint.method,
    url: getPlannableTermsEndpoint.path,
    handler: controller.listTerms,
  });
}
