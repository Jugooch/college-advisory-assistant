/**
 * @file Composition root for the conversation: the transcript read and clear.
 * @module @caa/api/wiring/conversation
 * @see docs/adr/0014-api-composition-root-wiring-files.md
 */
import { ConversationProvider } from '../config/env';
import type { ContainerOptions } from '../container';
import type { AccessService } from '../modules/access/access.service';
import {
  type ConversationStoreController,
  createConversationStoreController,
} from '../modules/conversation-store/conversation-store.controller';
import { createConversationStoreService } from '../modules/conversation-store/conversation-store.service';

/** What {@link wireConversation} builds. */
export interface ConversationWiring {
  readonly conversationStore: ConversationStoreController;
}

/**
 * Builds the conversation transcript service and controller.
 *
 * @param options - Configuration, repositories, and clock.
 * @param access - The access rule, including who may converse.
 * @returns The conversation controllers.
 */
export function wireConversation(
  options: ContainerOptions,
  access: AccessService,
): ConversationWiring {
  const { env, repositories, now } = options;
  return {
    conversationStore: createConversationStoreController(
      createConversationStoreService({
        access,
        conversations: repositories.conversations,
        now,
        // SAFETY: `off` is the kill switch; the transcript still reads, and says chat is off.
        isAvailable: env.CONVERSATION_MODEL !== ConversationProvider.Off,
      }),
    ),
  };
}
