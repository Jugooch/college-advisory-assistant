/**
 * @file Registers the advisor case queue route. The path comes from the shared contract.
 * @module @caa/api/modules/case-queue/case-queue.routes
 * @requirement FR-12
 */
import type { FastifyInstance } from 'fastify';

import { listAdvisorCasesEndpoint } from '@caa/api-contract';

import type { CaseQueueController } from './case-queue.controller';

/**
 * Registers the queue read. It only reads app-owned data.
 *
 * @param app - The authenticated route scope.
 * @param controller - The queue handler.
 */
export function registerCaseQueueRoutes(
  app: FastifyInstance,
  controller: CaseQueueController,
): void {
  app.route({
    method: listAdvisorCasesEndpoint.method,
    url: listAdvisorCasesEndpoint.path,
    handler: controller.listAdvisorCases,
  });
}
