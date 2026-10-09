/**
 * @file Builds synthetic assistant turn views and conversation responses for tests.
 * @module @caa/test-kit/builders/assistant-turn-view
 */
import type { z } from 'zod';

import {
  type AssistantTurnView,
  AssistantTurnViewSchema,
  type ConversationResponse,
  ConversationResponseSchema,
  type ConversationTurnView,
  ConversationTurnViewSchema,
  TemplateBlockEntrySchema,
} from '@caa/api-contract';
import { AssistantBlockKind, NoticeCode } from '@caa/domain';

import { buildNoticeBlock, buildPolicyResultsBlock } from './assistant-block.builder';
import { buildAssistantBlockRef } from './assistant-block-ref.builder';

/** One re-rendered template block entry, as the contract reads it. */
export type TemplateBlockEntry = z.infer<typeof TemplateBlockEntrySchema>;

/** Raw input accepted for an assistant turn view, as the contract schema reads it. */
export type AssistantTurnViewInput = z.input<typeof AssistantTurnViewSchema>;

/** Raw input accepted for a conversation response, as the contract schema reads it. */
export type ConversationResponseInput = z.input<typeof ConversationResponseSchema>;

/**
 * Builds a valid answered assistant turn view at sequence 2 with a short intro and one policy
 * results block. `sequence` must be `null` exactly for `RATE_LIMITED` and `DISABLED`.
 *
 * @param overrides - Fields to replace in the default.
 * @returns A validated assistant turn view.
 */
export function buildAssistantTurnView(
  overrides: Partial<AssistantTurnViewInput> = {},
): AssistantTurnView {
  return AssistantTurnViewSchema.parse({
    sequence: 2,
    intro: 'Here is what the approved policy says.',
    modelStatus: 'ANSWERED',
    blocks: [buildPolicyResultsBlock()],
    ...overrides,
  });
}

/**
 * Builds a stored student turn view at sequence 1.
 *
 * @param overrides - Fields to replace in the default.
 * @returns A validated student turn view.
 */
export function buildStudentTurnView(
  overrides: Partial<Extract<ConversationTurnView, { role: 'STUDENT' }>> = {},
): ConversationTurnView {
  return ConversationTurnViewSchema.parse({
    role: 'STUDENT',
    sequence: 1,
    createdAt: '2026-09-22T10:00:00.000-05:00',
    text: 'What is the late registration process?',
    ...overrides,
  });
}

/**
 * Builds a stored answered assistant turn view at sequence 2 with one policy results block
 * reference and no live result.
 *
 * @param overrides - Fields to replace in the default.
 * @returns A validated assistant turn view.
 */
export function buildStoredAssistantTurnView(
  overrides: Partial<Extract<ConversationTurnView, { role: 'ASSISTANT' }>> = {},
): ConversationTurnView {
  return ConversationTurnViewSchema.parse({
    role: 'ASSISTANT',
    sequence: 2,
    createdAt: '2026-09-22T10:00:03.000-05:00',
    intro: 'Here is what the approved policy says.',
    modelStatus: 'ANSWERED',
    blockRefs: [buildAssistantBlockRef()],
    ...overrides,
  });
}

/**
 * Builds a valid available conversation response with one student turn and one answer.
 *
 * `lastSequence` defaults to the sequence of the last turn, or 0 when there are no turns.
 *
 * @param overrides - Fields to replace in the default. `unavailableReason` must be `DISABLED`
 *   exactly when `available` is `false`.
 * @returns A validated conversation response.
 */
export function buildConversationResponse(
  overrides: Partial<ConversationResponseInput> = {},
): ConversationResponse {
  const turns = overrides.turns ?? [buildStudentTurnView(), buildStoredAssistantTurnView()];
  return ConversationResponseSchema.parse({
    available: true,
    unavailableReason: null,
    lastSequence: turns.at(-1)?.sequence ?? 0,
    ...overrides,
    turns,
  });
}

/**
 * Builds an unavailable (chat off) conversation response with no turns.
 *
 * @returns A validated conversation response with reason `DISABLED`.
 */
export function buildUnavailableConversationResponse(): ConversationResponse {
  return buildConversationResponse({ available: false, unavailableReason: 'DISABLED', turns: [] });
}

/**
 * Builds one re-rendered template block entry: the notice block at `refIndex` 0. Pair it with a
 * stored turn whose ref at that index names the same template id, version and code.
 *
 * @param overrides - Fields to replace in the default.
 * @returns A validated entry.
 */
export function buildTemplateBlockEntry(
  overrides: Partial<z.input<typeof TemplateBlockEntrySchema>> = {},
): TemplateBlockEntry {
  return TemplateBlockEntrySchema.parse({ refIndex: 0, block: buildNoticeBlock(), ...overrides });
}

/**
 * Builds a stored answered assistant turn at sequence 2 whose only ref is the rate-limited notice
 * and whose `templateBlocks` holds its re-rendered block.
 *
 * @param overrides - Fields to replace in the default.
 * @returns A validated assistant turn view.
 */
export function buildStoredNoticeTurnView(
  overrides: Partial<Extract<ConversationTurnView, { role: 'ASSISTANT' }>> = {},
): ConversationTurnView {
  return buildStoredAssistantTurnView({
    blockRefs: [
      buildAssistantBlockRef({
        kind: AssistantBlockKind.Notice,
        code: NoticeCode.RateLimited,
        templateId: 'notice-rate-limited',
        templateVersion: '1',
      }),
    ],
    templateBlocks: [buildTemplateBlockEntry()],
    ...overrides,
  });
}
