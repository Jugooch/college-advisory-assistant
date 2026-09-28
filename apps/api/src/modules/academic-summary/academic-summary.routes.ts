/**
 * @file Registers the academic summary routes. Paths come from the shared contract.
 * @module @caa/api/modules/academic-summary/academic-summary.routes
 * @requirement FR-02
 * @requirement FR-05
 */
import type { FastifyInstance } from 'fastify';

import { getAcademicSummaryEndpoint } from '@caa/api-contract';

import type { AcademicSummaryController } from './academic-summary.controller';

/**
 * Registers every route in the academic summary module. Call inside the authenticated scope.
 *
 * @param app - Authenticated Fastify scope.
 * @param controller - Academic summary controller.
 */
export function registerAcademicSummaryRoutes(
  app: FastifyInstance,
  controller: AcademicSummaryController,
): void {
  app.route({
    method: getAcademicSummaryEndpoint.method,
    url: getAcademicSummaryEndpoint.path,
    handler: controller.getAcademicSummary,
  });
}
