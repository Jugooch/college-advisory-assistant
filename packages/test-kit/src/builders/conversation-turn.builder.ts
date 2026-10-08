/**
 * @file Builds synthetic student and assistant conversation turns for tests.
 * @module @caa/test-kit/builders/conversation-turn
 */
import {
  type ConversationTurn,
  type ConversationTurnInput,
  createConversationTurn,
  ModelStatus,
  TurnRole,
} from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';
import { buildAssistantBlockRef } from './assistant-block-ref.builder';

/** A student turn's input. */
export type StudentTurnInput = Extract<ConversationTurnInput, { role: 'STUDENT' }>;

/** An assistant turn's input. */
export type AssistantTurnInput = Extract<ConversationTurnInput, { role: 'ASSISTANT' }>;

/**
 * Builds a valid student turn, sequence 1 of conversation seed 1.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes turns; drives the default `id`.
 * @returns A validated student turn.
 */
export function buildStudentTurn(
  overrides: Partial<Omit<StudentTurnInput, 'role'>> = {},
  seed = 1,
): ConversationTurn {
  return createConversationTurn({
    id: syntheticId('conversationTurn', seed),
    conversationId: syntheticId('conversation', 1),
    sequence: 1,
    createdAt: '2026-09-22T10:00:00.000-05:00',
    text: 'What is the late registration process?',
    ...overrides,
    role: TurnRole.Student,
  });
}

/**
 * Builds a valid answered assistant turn, sequence 2 of conversation seed 1, with one policy
 * results block reference and no guard reasons.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes turns; drives the default `id`.
 * @returns A validated assistant turn.
 */
export function buildAssistantTurn(
  overrides: Partial<Omit<AssistantTurnInput, 'role'>> = {},
  seed = 2,
): ConversationTurn {
  return createConversationTurn({
    id: syntheticId('conversationTurn', seed),
    conversationId: syntheticId('conversation', 1),
    sequence: 2,
    createdAt: '2026-09-22T10:00:03.000-05:00',
    text: 'Here is what the approved policy says.',
    blockRefs: [buildAssistantBlockRef()],
    modelStatus: ModelStatus.Answered,
    metadata: {
      modelId: 'synthetic-model-1',
      promptVersion: 'prompt-1',
      toolSchemaVersion: 'tools-1',
      templateVersion: 'templates-1',
      guardReasons: [],
      policyRevisions: [{ documentKey: 'late-registration', revision: 1 }],
    },
    ...overrides,
    role: TurnRole.Assistant,
  });
}
