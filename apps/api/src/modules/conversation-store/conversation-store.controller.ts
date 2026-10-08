/**
 * @file HTTP handlers for the conversation transcript.
 * @module @caa/api/modules/conversation-store/conversation-store.controller
 * @requirement FR-01
 * @requirement FR-02
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ConversationQuerySchema, ConversationResponseSchema } from '@caa/api-contract';
import { StudentIdSchema } from '@caa/domain';

import { requireActor } from '../../plugins/auth.plugin';
import { InvalidRequestError, NotFoundError } from '../../shared/domain-errors';
import { sendData } from '../../shared/send-data';
import type { ConversationStoreService } from './conversation-store.service';

const ConversationParamsSchema = z.object({ studentId: StudentIdSchema });

/** Handlers for the conversation transcript routes. */
export interface ConversationStoreController {
  readonly getConversation: (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;
  readonly clearConversation: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<FastifyReply>;
}

/**
 * Creates the conversation transcript controller.
 *
 * @param service - The conversation store service.
 * @returns The controller.
 */
export function createConversationStoreController(
  service: ConversationStoreService,
): ConversationStoreController {
  const parse = (request: FastifyRequest) => {
    const params = ConversationParamsSchema.safeParse(request.params);
    // SECURITY: a malformed ID is NOT_FOUND, not INVALID_REQUEST, so IDs can't be probed.
    if (!params.success) {
      throw new NotFoundError();
    }
    // SECURITY: the query is strict, so a tenant, user or role in it is refused.
    const query = ConversationQuerySchema.safeParse(request.query);
    if (!query.success) {
      throw new InvalidRequestError();
    }
    return { studentId: params.data.studentId, termId: query.data.termId };
  };

  return {
    getConversation: async (request, reply) => {
      const actor = requireActor(request);
      const target = parse(request);
      const response = await service.getConversation(actor, target, { logger: request.log });
      return sendData(reply, ConversationResponseSchema, response);
    },
    clearConversation: async (request, reply) => {
      const actor = requireActor(request);
      const target = parse(request);
      await service.clearConversation(actor, target, { logger: request.log });
      return reply.code(204).send();
    },
  };
}
