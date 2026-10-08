/**
 * @file Tests for the conversation turn data object.
 */
import { describe, expect, it } from 'vitest';

import { type ConversationTurnInput, createConversationTurn } from './conversation-turn.model';

const CONVERSATION_ID = '5a000000-0000-4000-8000-000000000001';

const STUDENT_TURN = {
  id: '5a000000-0000-4000-8000-000000000010',
  conversationId: CONVERSATION_ID,
  sequence: 1,
  role: 'STUDENT',
  text: 'Find me a schedule without Fridays.',
  createdAt: '2026-10-08T09:01:00.000-05:00',
} as const satisfies ConversationTurnInput;

const ASSISTANT_TURN = {
  id: '5a000000-0000-4000-8000-000000000011',
  conversationId: CONVERSATION_ID,
  sequence: 2,
  role: 'ASSISTANT',
  text: 'Here are your schedule options.',
  blockRefs: [{ kind: 'SCHEDULE_OPTIONS', shownAt: '2026-10-08T09:01:05.000-05:00' }],
  modelStatus: 'ANSWERED',
  metadata: {
    modelId: 'fictional-model-1',
    promptVersion: 'p1',
    toolSchemaVersion: 't1',
    templateVersion: 'v1',
    guardReasons: [],
    policyRevisions: [],
  },
  createdAt: '2026-10-08T09:01:06.000-05:00',
} as const satisfies ConversationTurnInput;

describe('createConversationTurn', () => {
  it('accepts a student turn and an assistant turn', () => {
    expect(createConversationTurn(STUDENT_TURN).role).toBe('STUDENT');
    expect(createConversationTurn(ASSISTANT_TURN).role).toBe('ASSISTANT');
  });

  it('rejects sequence 0', () => {
    expect(() => createConversationTurn({ ...STUDENT_TURN, sequence: 0 })).toThrow();
  });

  it('caps student text at 1,000 and refuses empty text', () => {
    expect(() => createConversationTurn({ ...STUDENT_TURN, text: 'a'.repeat(1000) })).not.toThrow();
    expect(() => createConversationTurn({ ...STUDENT_TURN, text: 'a'.repeat(1001) })).toThrow();
    expect(() => createConversationTurn({ ...STUDENT_TURN, text: '' })).toThrow();
  });

  it('caps assistant text at 600 and allows empty text', () => {
    expect(() =>
      createConversationTurn({ ...ASSISTANT_TURN, text: 'a'.repeat(600) }),
    ).not.toThrow();
    expect(() => createConversationTurn({ ...ASSISTANT_TURN, text: 'a'.repeat(601) })).toThrow();
    expect(() => createConversationTurn({ ...ASSISTANT_TURN, text: '' })).not.toThrow();
  });

  it.each(['blockRefs', 'modelStatus', 'metadata'] as const)(
    'refuses %s on a student turn',
    (field) => {
      const extra = { ...STUDENT_TURN, [field]: ASSISTANT_TURN[field] };
      expect(() => createConversationTurn(extra as unknown as ConversationTurnInput)).toThrow();
    },
  );

  it.each(['blockRefs', 'modelStatus', 'metadata'] as const)(
    'requires %s on an assistant turn',
    (field) => {
      const input = { ...ASSISTANT_TURN, [field]: undefined };
      expect(() => createConversationTurn(input as unknown as ConversationTurnInput)).toThrow();
    },
  );

  it.each(['RATE_LIMITED', 'DISABLED'] as const)('refuses the unstored status %s', (status) => {
    const input = { ...ASSISTANT_TURN, modelStatus: status };
    expect(() => createConversationTurn(input as unknown as ConversationTurnInput)).toThrow();
  });

  it('accepts a null model id for a turn that made no model call', () => {
    const turn = createConversationTurn({
      ...ASSISTANT_TURN,
      modelStatus: 'MODEL_UNAVAILABLE',
      metadata: { ...ASSISTANT_TURN.metadata, modelId: null },
    });
    expect(turn.role === 'ASSISTANT' && turn.metadata.modelId).toBeNull();
  });
});
