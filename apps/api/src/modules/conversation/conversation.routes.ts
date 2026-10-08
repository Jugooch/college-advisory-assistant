/**
 * @file Registers the conversation turn route. The path comes from the shared contract.
 * @module @caa/api/modules/conversation/conversation.routes
 * @requirement FR-01
 * @requirement FR-02
 */
import type { FastifyInstance } from 'fastify';

import { postConversationTurnEndpoint } from '@caa/api-contract';

import type { ConversationController } from './conversation.controller';

/**
 * Registers the turn route. It writes no institutional system: it reads through the existing
 * services and stores the student's own transcript.
 *
 * @param app - The authenticated route scope.
 * @param controller - The turn handler.
 */
export function registerConversationRoutes(
  app: FastifyInstance,
  controller: ConversationController,
): void {
  app.route({
    method: postConversationTurnEndpoint.method,
    url: postConversationTurnEndpoint.path,
    handler: controller.postTurn,
  });
}
