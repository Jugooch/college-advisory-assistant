/**
 * @file Composition root for the conversation: the transcript, the turn endpoint, and the choice
 * of model.
 * @module @caa/api/wiring/conversation
 * @see docs/adr/0014-api-composition-root-wiring-files.md
 */
import { type ConversationModel, createDemoModel } from '@caa/assistant';

import { createClaudeModel, DEFAULT_MODEL_TIMEOUT_MS } from '../adapters/claude-model.adapter';
import { type ApiEnv, ConversationModelMode } from '../config/env';
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

/** The model id recorded when a test injects a model. */
const INJECTED_MODEL_ID = 'injected-test-model';

/** The model id recorded for the demo model. */
const DEMO_MODEL_ID = 'demo-model';

/** The chosen model and the id recorded with each turn. */
interface ChosenModel {
  readonly model: ConversationModel;
  readonly modelId: string;
}

/**
 * Picks the conversation model from configuration. `loadApiEnv` has already refused the demo
 * model in production, and Claude without a key or, in production, an approval ref.
 *
 * @param env - Configuration validated by `loadApiEnv`.
 * @param injected - A model a test supplies; it replaces the configured one.
 * @returns The model, or `null` when chat is off.
 */
function chooseConversationModel(
  env: ApiEnv,
  injected: ConversationModel | undefined,
): ChosenModel | null {
  if (injected !== undefined) return { model: injected, modelId: INJECTED_MODEL_ID };
  // SAFETY: the switch is the kill switch (ADR-0015 section 1); `off` builds no model at all.
  switch (env.CONVERSATION_MODEL) {
    case ConversationModelMode.Off:
      return null;
    case ConversationModelMode.Demo:
      return { model: createDemoModel(), modelId: DEMO_MODEL_ID };
    case ConversationModelMode.Claude:
      // NOTE: narrowing only; env validation guarantees the key for `claude`.
      if (env.ANTHROPIC_API_KEY === undefined) return null;
      return {
        model: createClaudeModel({
          apiKey: env.ANTHROPIC_API_KEY,
          modelId: env.CONVERSATION_MODEL_ID,
          timeoutMs: DEFAULT_MODEL_TIMEOUT_MS,
        }),
        modelId: env.CONVERSATION_MODEL_ID,
      };
  }
}

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
