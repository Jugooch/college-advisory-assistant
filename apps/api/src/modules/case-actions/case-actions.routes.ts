/**
 * @file Registers the case action route. The path comes from the shared contract.
 * @module @caa/api/modules/case-actions/case-actions.routes
 * @requirement FR-12
 * @requirement FR-15
 */
import type { FastifyInstance } from 'fastify';

import { addCaseEventEndpoint } from '@caa/api-contract';

import type { CaseActionsController } from './case-actions.controller';

/**
 * Registers the action route. It changes app-owned case rows only: nothing is sent outside the
 * app or written to an institutional system.
 *
 * @param app - The authenticated route scope.
 * @param controller - The action handler.
 */
export function registerCaseActionsRoutes(
  app: FastifyInstance,
  controller: CaseActionsController,
): void {
  app.route({
    method: addCaseEventEndpoint.method,
    url: addCaseEventEndpoint.path,
    handler: controller.addCaseEvent,
  });
}
