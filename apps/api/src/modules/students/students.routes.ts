/**
 * @file Registers the students routes. Paths come from the shared contract.
 * @module @caa/api/modules/students/students.routes
 * @requirement FR-02
 */
import type { FastifyInstance } from 'fastify';

import { getStudentEndpoint } from '@caa/api-contract';

import type { StudentsController } from './students.controller';

/**
 * Registers every route in the students module. Call inside the authenticated scope.
 *
 * @param app - Authenticated Fastify scope.
 * @param controller - Students controller.
 */
export function registerStudentsRoutes(app: FastifyInstance, controller: StudentsController): void {
  app.route({
    method: getStudentEndpoint.method,
    url: getStudentEndpoint.path,
    handler: controller.getStudent,
  });
}
