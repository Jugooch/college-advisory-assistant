/**
 * @file HTTP handlers for the students module.
 * @module @caa/api/modules/students/students.controller
 * @requirement FR-02
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { StudentResponseSchema } from '@caa/api-contract';
import { StudentIdSchema } from '@caa/domain';

import { requireActor } from '../../plugins/auth.plugin';
import { NotFoundError } from '../../shared/domain-errors';
import { sendData } from '../../shared/send-data';
import type { StudentsService } from './students.service';

/** Path params of `GET /v1/students/:studentId`. */
const StudentParamsSchema = z.object({ studentId: StudentIdSchema });

/** Handlers for the students routes. Declared as properties so they can be passed to routes unbound. */
export interface StudentsController {
  readonly getStudent: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
}

/**
 * Creates the students controller.
 *
 * @param service - Students service.
 * @returns A {@link StudentsController}.
 */
export function createStudentsController(service: StudentsService): StudentsController {
  return {
    getStudent: async (request, reply) => {
      const actor = requireActor(request);
      const params = StudentParamsSchema.safeParse(request.params);
      // SECURITY: a malformed ID is NOT_FOUND, not INVALID_REQUEST, so IDs can't be probed.
      if (!params.success) {
        throw new NotFoundError();
      }
      // NOTE: request.log is Fastify's per-request child logger; every line it writes has reqId.
      const student = await service.getStudent(actor, params.data.studentId, request.log);
      return sendData(reply, StudentResponseSchema, student);
    },
  };
}
