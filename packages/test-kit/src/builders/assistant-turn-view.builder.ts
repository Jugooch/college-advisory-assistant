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
} from '@caa/api-contract';

import { buildPolicyResultsBlock } from './assistant-block.builder';
import { buildAssistantBlockRef } from './assistant-block-ref.builder';

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
 * @param overrides - Fields to replace in the default. `unavailableReason` must be `DISABLED`
 *   exactly when `available` is `false`.
 * @returns A validated conversation response.
 */
export function buildConversationResponse(
  overrides: Partial<ConversationResponseInput> = {},
): ConversationResponse {
  return ConversationResponseSchema.parse({
    available: true,
    unavailableReason: null,
    turns: [buildStudentTurnView(), buildStoredAssistantTurnView()],
    ...overrides,
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
