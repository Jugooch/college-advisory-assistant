/**
 * @file HTTP handlers for the schedule options module.
 * @module @caa/api/modules/schedule-options/schedule-options.controller
 * @requirement FR-01
 * @requirement FR-07
 * @requirement FR-10
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ScheduleOptionsRequestSchema, ScheduleOptionsResponseSchema } from '@caa/api-contract';
import { StudentIdSchema } from '@caa/domain';

import { requireActor } from '../../plugins/auth.plugin';
import { InvalidRequestError, NotFoundError } from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import { sendData } from '../../shared/send-data';
import type { ScheduleOptionsService } from './schedule-options.service';

const ScheduleOptionsParamsSchema = z.object({ studentId: StudentIdSchema });

/** Handlers for the schedule options routes. */
export interface ScheduleOptionsController {
  readonly findOptions: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
}

/**
 * Creates the schedule options controller.
 *
 * @param service - The schedule options service.
 * @returns The controller.
 */
export function createScheduleOptionsController(
  service: ScheduleOptionsService,
): ScheduleOptionsController {
  return {
    findOptions: async (request, reply) => {
      const actor = requireActor(request);
      const params = ScheduleOptionsParamsSchema.safeParse(request.params);
      // SECURITY: a malformed ID is NOT_FOUND, not INVALID_REQUEST, so IDs can't be probed.
      if (!params.success) {
        throw new NotFoundError();
      }
      // SECURITY: the strict schema rejects any tenant, user, or role field; identity comes
      // only from the session (FR-01).
      const body = ScheduleOptionsRequestSchema.safeParse(request.body);
      if (!body.success) {
        throw new InvalidRequestError();
      }
      const context: RequestContext = { logger: request.log };
      const query = { studentId: params.data.studentId, ...body.data };
      const options = await service.findOptions(actor, query, context);
      return sendData(reply, ScheduleOptionsResponseSchema, options);
    },
  };
}
