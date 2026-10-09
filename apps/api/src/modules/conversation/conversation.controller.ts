/**
 * @file HTTP handler for posting a conversation turn.
 * @module @caa/api/modules/conversation/conversation.controller
 * @requirement FR-01
 * @requirement FR-02
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ConversationTurnRequestSchema, ConversationTurnResponseSchema } from '@caa/api-contract';
import { StudentIdSchema } from '@caa/domain';

import { requireActor } from '../../plugins/auth.plugin';
import { InvalidRequestError, NotFoundError } from '../../shared/domain-errors';
import { sendData } from '../../shared/send-data';
import type { ConversationService } from './conversation.service';

const TurnParamsSchema = z.object({ studentId: StudentIdSchema });

/** Handler for the conversation turn route. */
export interface ConversationController {
  readonly postTurn: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
}

/**
 * Creates the conversation turn controller.
 *
 * @param service - The conversation turn service.
 * @returns The controller.
 */
export function createConversationController(service: ConversationService): ConversationController {
  return {
    postTurn: async (request, reply) => {
      const actor = requireActor(request);
      const params = TurnParamsSchema.safeParse(request.params);
      // SECURITY: a malformed ID is NOT_FOUND, not INVALID_REQUEST, so IDs can't be probed.
      if (!params.success) {
        throw new NotFoundError();
      }
      // SECURITY: the body is strict, so a tenant, user, role, or any prior assistant turn is
      // refused; identity comes only from the session and history from the store.
      const body = ConversationTurnRequestSchema.safeParse(request.body);
      if (!body.success) {
        throw new InvalidRequestError();
      }
      const response = await service.postTurn(
        actor,
        { studentId: params.data.studentId, ...body.data },
        { logger: request.log },
      );
      return sendData(reply, ConversationTurnResponseSchema, response);
    },
  };
}
