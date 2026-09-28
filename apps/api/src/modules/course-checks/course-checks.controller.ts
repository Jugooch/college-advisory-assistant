/**
 * @file HTTP handlers for the course checks module.
 * @module @caa/api/modules/course-checks/course-checks.controller
 * @requirement FR-01
 * @requirement FR-05
 * @requirement FR-10
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { CourseChecksRequestSchema, CourseChecksResponseSchema } from '@caa/api-contract';
import { StudentIdSchema } from '@caa/domain';

import { requireActor } from '../../plugins/auth.plugin';
import { InvalidRequestError, NotFoundError } from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import { sendData } from '../../shared/send-data';
import type { CourseChecksService } from './course-checks.service';

/** Path params of `POST /v1/students/:studentId/course-checks`. */
const CourseChecksParamsSchema = z.object({ studentId: StudentIdSchema });

/** Handlers for the course checks routes, as properties so routes can take them unbound. */
export interface CourseChecksController {
  readonly checkCourses: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
}

/**
 * Creates the course checks controller.
 *
 * @param service - Course checks service.
 * @returns A {@link CourseChecksController}.
 */
export function createCourseChecksController(service: CourseChecksService): CourseChecksController {
  return {
    checkCourses: async (request, reply) => {
      const actor = requireActor(request);
      const params = CourseChecksParamsSchema.safeParse(request.params);
      // SECURITY: a malformed ID is NOT_FOUND, not INVALID_REQUEST, so IDs can't be probed.
      if (!params.success) {
        throw new NotFoundError();
      }
      // SECURITY: the strict schema rejects any tenant, user, or role field; identity comes
      // only from the session (FR-01).
      const body = CourseChecksRequestSchema.safeParse(request.body);
      if (!body.success) {
        throw new InvalidRequestError();
      }
      const context: RequestContext = { logger: request.log };
      const query = { studentId: params.data.studentId, ...body.data };
      const checks = await service.checkCourses(actor, query, context);
      return sendData(reply, CourseChecksResponseSchema, checks);
    },
  };
}
