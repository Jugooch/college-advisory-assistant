/**
 * @file Composition root for the conversation: the transcript, the turn endpoint, and the choice
 * of model.
 * @module @caa/api/wiring/conversation
 * @see docs/adr/0014-api-composition-root-wiring-files.md
 */
import { chooseConversationModel } from '../adapters/conversation-model.adapter';
import type { ContainerOptions } from '../container';
import type { AcademicSummaryService } from '../modules/academic-summary/academic-summary.service';
import type { AccessService } from '../modules/access/access.service';
import {
  type ConversationController,
  createConversationController,
} from '../modules/conversation/conversation.controller';
import { createConversationService } from '../modules/conversation/conversation.service';
import { createConversationAnswerService } from '../modules/conversation-answer/conversation-answer.service';
import { createConversationBlocksService } from '../modules/conversation-blocks/conversation-blocks.service';
import { createConversationLoopService } from '../modules/conversation-loop/conversation-loop.service';
import {
  type ConversationStoreController,
  createConversationStoreController,
} from '../modules/conversation-store/conversation-store.controller';
import { createConversationStoreService } from '../modules/conversation-store/conversation-store.service';
import { createConversationToolRunnersService } from '../modules/conversation-tool-runners/conversation-tool-runners.service';
import { createConversationToolsService } from '../modules/conversation-tools/conversation-tools.service';
import { createConversationTurnStoreService } from '../modules/conversation-turn-store/conversation-turn-store.service';
import type { PlanViewsService } from '../modules/plan-views/plan-views.service';
import type { PolicySearchService } from '../modules/policy-search/policy-search.service';
import type { ScheduleOptionsService } from '../modules/schedule-options/schedule-options.service';

/** What {@link wireConversation} builds. */
export interface ConversationWiring {
  readonly conversationStore: ConversationStoreController;
  readonly conversation: ConversationController;
}

/** The read services the conversation tools call. */
export interface ConversationToolSources {
  readonly academicSummary: AcademicSummaryService;
  readonly policySearch: PolicySearchService;
  readonly scheduleOptions: ScheduleOptionsService;
  readonly planViews: PlanViewsService;
}

/**
 * Builds the conversation transcript and turn services and controllers.
 *
 * @param options - Configuration, repositories, clock, and an optional injected model.
 * @param access - The access rule, including who may converse.
 * @param sources - The read services the tools and the referral lookup call.
 * @returns The conversation controllers.
 */
export function wireConversation(
  options: ContainerOptions,
  access: AccessService,
  sources: ConversationToolSources,
): ConversationWiring {
  const { env, repositories, now } = options;
  const chosen = chooseConversationModel(env, options.conversationModel);
  const tools = createConversationToolsService({
    access,
    runners: createConversationToolRunnersService(sources),
  });
  return {
    conversationStore: createConversationStoreController(
      createConversationStoreService({
        access,
        conversations: repositories.conversations,
        now,
        isAvailable: chosen !== null,
      }),
    ),
    conversation: createConversationController(
      createConversationService({
        access,
        store: createConversationTurnStoreService({
          conversations: repositories.conversations,
          now,
          rateLimit: env.CONVERSATION_RATE_LIMIT,
        }),
        blocks: createConversationBlocksService({ policySearch: sources.policySearch }),
        answers: createConversationAnswerService({
          loop:
            chosen === null
              ? null
              : createConversationLoopService({ model: chosen.model, tools, now }),
          modelId: chosen?.modelId ?? null,
          historyTurns: env.CONVERSATION_HISTORY_TURNS,
        }),
        now,
      }),
    ),
  };
}
