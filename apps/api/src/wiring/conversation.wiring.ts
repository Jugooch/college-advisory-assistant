/**
 * @file Composition root for the conversation: the transcript read and clear.
 * @module @caa/api/wiring/conversation
 * @see docs/adr/0014-api-composition-root-wiring-files.md
 */
import { ConversationModelMode } from '../config/env';
import type { ContainerOptions } from '../container';
import type { AcademicSummaryService } from '../modules/academic-summary/academic-summary.service';
import type { AccessService } from '../modules/access/access.service';
import {
  type ConversationStoreController,
  createConversationStoreController,
} from '../modules/conversation-store/conversation-store.controller';
import { createConversationStoreService } from '../modules/conversation-store/conversation-store.service';
import { createConversationToolRunnersService } from '../modules/conversation-tool-runners/conversation-tool-runners.service';
import {
  type ConversationToolsService,
  createConversationToolsService,
} from '../modules/conversation-tools/conversation-tools.service';
import type { PlanViewsService } from '../modules/plan-views/plan-views.service';
import type { PolicySearchService } from '../modules/policy-search/policy-search.service';
import type { ScheduleOptionsService } from '../modules/schedule-options/schedule-options.service';

/** The read services the conversation tools call. */
export interface ConversationToolSources {
  readonly academicSummary: AcademicSummaryService;
  readonly policySearch: PolicySearchService;
  readonly scheduleOptions: ScheduleOptionsService;
  readonly planViews: PlanViewsService;
}

/** What {@link wireConversation} builds. */
export interface ConversationWiring {
  readonly conversationStore: ConversationStoreController;
  /** The tool dispatcher; the turn endpoint takes it from here. */
  readonly conversationTools: ConversationToolsService;
}

/**
 * Builds the conversation transcript service and controller, and binds the tools to the read services.
 *
 * @param options - Configuration, repositories, and clock.
 * @param access - The access rule, including who may converse.
 * @param sources - The read services the tools call.
 * @returns The conversation controllers.
 */
export function wireConversation(
  options: ContainerOptions,
  access: AccessService,
  sources: ConversationToolSources,
): ConversationWiring {
  const { env, repositories, now } = options;
  return {
    conversationStore: createConversationStoreController(
      createConversationStoreService({
        access,
        conversations: repositories.conversations,
        now,
        // SAFETY: `off` is the kill switch; the transcript still reads, and says chat is off.
        isAvailable: env.CONVERSATION_MODEL !== ConversationModelMode.Off,
      }),
    ),
    conversationTools: createConversationToolsService({
      access,
      runners: createConversationToolRunnersService(sources),
    }),
  };
}
