/**
 * @file Registers the conversation transcript routes. Paths come from the shared contract.
 * @module @caa/api/modules/conversation-store/conversation-store.routes
 * @requirement FR-01
 * @requirement FR-02
 */
import type { FastifyInstance } from 'fastify';

import { clearConversationEndpoint, getConversationEndpoint } from '@caa/api-contract';

import type { ConversationStoreController } from './conversation-store.controller';

/**
 * Registers the transcript read and clear routes. Neither writes to an institutional system.
 *
 * @param app - The authenticated route scope.
 * @param controller - The transcript handlers.
 */
export function registerConversationStoreRoutes(
  app: FastifyInstance,
  controller: ConversationStoreController,
): void {
  app.route({
    method: getConversationEndpoint.method,
    url: getConversationEndpoint.path,
    handler: controller.getConversation,
  });
  app.route({
    method: clearConversationEndpoint.method,
    url: clearConversationEndpoint.path,
    handler: controller.clearConversation,
  });
}
