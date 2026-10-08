/**
 * @file HTTP handler for the advisor and admin case queue.
 * @module @caa/api/modules/case-queue/case-queue.controller
 * @requirement FR-02
 * @requirement FR-12
 * @requirement FR-14
 */
import type { FastifyReply, FastifyRequest } from 'fastify';

import { CaseQueueQuerySchema, CaseQueueResponseSchema } from '@caa/api-contract';

import { requireActor } from '../../plugins/auth.plugin';
import { InvalidRequestError } from '../../shared/domain-errors';
import { sendData } from '../../shared/send-data';
import type { CaseQueueService } from './case-queue.service';

/** Handlers for the queue route. */
export interface CaseQueueController {
  readonly listAdvisorCases: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<FastifyReply>;
}

/**
 * Creates the case queue controller.
 *
 * @param queue - The case queue service.
 * @returns The controller.
 */
export function createCaseQueueController(queue: CaseQueueService): CaseQueueController {
  return {
    listAdvisorCases: async (request, reply) => {
      const actor = requireActor(request);
      // SECURITY: strict query; the tenant and the advisor come from the session only.
      const query = CaseQueueQuerySchema.safeParse(request.query);
      if (!query.success) {
        throw new InvalidRequestError();
      }
      return sendData(
        reply,
        CaseQueueResponseSchema,
        await queue.listQueue(actor, query.data, { logger: request.log }),
      );
    },
  };
}
