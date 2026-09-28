/**
 * @file Registers the course checks routes. Paths come from the shared contract.
 * @module @caa/api/modules/course-checks/course-checks.routes
 * @requirement FR-05
 * @requirement FR-10
 */
import type { FastifyInstance } from 'fastify';

import { checkCoursesEndpoint } from '@caa/api-contract';

import type { CourseChecksController } from './course-checks.controller';

/**
 * Registers every route in the course checks module. Call inside the authenticated scope.
 *
 * @param app - Authenticated Fastify scope.
 * @param controller - Course checks controller.
 */
export function registerCourseChecksRoutes(
  app: FastifyInstance,
  controller: CourseChecksController,
): void {
  app.route({
    method: checkCoursesEndpoint.method,
    url: checkCoursesEndpoint.path,
    handler: controller.checkCourses,
  });
}
