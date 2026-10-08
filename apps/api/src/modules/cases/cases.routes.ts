/**
 * @file Registers the student's case routes. Paths come from the shared contract.
 * @module @caa/api/modules/cases/cases.routes
 * @requirement FR-12
 * @requirement FR-17
 */
import type { FastifyInstance } from 'fastify';

import { createCaseEndpoint, getCaseEndpoint, listStudentCasesEndpoint } from '@caa/api-contract';

import type { CasesController } from './cases.controller';

/**
 * Registers create, list, and read. Cases are app-owned data: no route sends anything outside
 * the app or writes to an institutional system. The advisor queue and actions have their own modules.
 *
 * @param app - The authenticated route scope.
 * @param controller - The case handlers.
 */
export function registerCasesRoutes(app: FastifyInstance, controller: CasesController): void {
  app.route({
    method: createCaseEndpoint.method,
    url: createCaseEndpoint.path,
    handler: controller.createCase,
  });
  app.route({
    method: listStudentCasesEndpoint.method,
    url: listStudentCasesEndpoint.path,
    handler: controller.listStudentCases,
  });
  app.route({
    method: getCaseEndpoint.method,
    url: getCaseEndpoint.path,
    handler: controller.getCase,
  });
}
