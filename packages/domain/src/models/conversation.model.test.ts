/**
 * @file Tests for the conversation and conversation turn data objects and their enums.
 */
import { describe, expect, it } from 'vitest';

import { AssistantBlockKind } from '../enums/assistant-block-kind.enum';
import { ModelStatus } from '../enums/model-status.enum';
import { NoticeCode } from '../enums/notice-code.enum';
import { TurnRole } from '../enums/turn-role.enum';
import { AssistantBlockRefSchema } from './assistant-block-ref.model';
import { type ConversationInput, createConversation } from './conversation.model';
import { type ConversationTurnInput, createConversationTurn } from './conversation-turn.model';

const CONVERSATION: ConversationInput = {
  id: '5a000000-0000-4000-8000-000000000001',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  studentId: '5a000000-0000-4000-8000-000000000002',
  termId: '5a000000-0000-4000-8000-000000000003',
  createdAt: '2026-10-08T09:00:00.000-05:00',
};

const STUDENT_TURN = {
  id: '5a000000-0000-4000-8000-000000000010',
  conversationId: CONVERSATION.id,
  sequence: 1,
  role: 'STUDENT',
  text: 'Find me a schedule without Fridays.',
  createdAt: '2026-10-08T09:01:00.000-05:00',
} as const satisfies ConversationTurnInput;

const ASSISTANT_TURN = {
  id: '5a000000-0000-4000-8000-000000000011',
  conversationId: CONVERSATION.id,
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

describe('enums', () => {
  it('lists the ADR-0015 values', () => {
    expect(Object.values(TurnRole)).toEqual(['STUDENT', 'ASSISTANT']);
    expect(Object.values(ModelStatus)).toEqual([
      'ANSWERED',
      'GUARDED',
      'BUDGET_EXHAUSTED',
      'MODEL_UNAVAILABLE',
      'RATE_LIMITED',
      'DISABLED',
    ]);
    expect(Object.values(AssistantBlockKind)).toHaveLength(8);
    expect(Object.values(NoticeCode)).toHaveLength(10);
  });
});

describe('createConversation', () => {
  it('accepts a valid conversation', () => {
    expect(createConversation(CONVERSATION)).toEqual(CONVERSATION);
  });

  it('rejects a missing tenant', () => {
    const input = { ...CONVERSATION, tenantId: undefined };
    expect(() => createConversation(input as unknown as ConversationInput)).toThrow();
  });
});

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

  it('accepts a null model id for a turn that made no model call', () => {
    const turn = createConversationTurn({
      ...ASSISTANT_TURN,
      modelStatus: 'DISABLED',
      metadata: { ...ASSISTANT_TURN.metadata, modelId: null },
    });
    expect(turn.role === 'ASSISTANT' && turn.metadata.modelId).toBeNull();
  });
});

describe('AssistantBlockRefSchema', () => {
  const planRef = {
    kind: 'PLAN_EVIDENCE',
    planId: '5a000000-0000-4000-8000-000000000020',
    planRevisionId: '5a000000-0000-4000-8000-000000000021',
    revision: 2,
  };

  it('accepts reference-only variants', () => {
    const refs = [
      planRef,
      { kind: 'POLICY_RESULTS', documents: [{ documentKey: 'add-drop', revision: 1 }] },
      { kind: 'CASE_PREVIEW', reason: 'PLAN_REVIEW' },
      {
        kind: 'NOTICE',
        code: 'TOOL_FAILED',
        templateId: 'notice.tool-failed',
        templateVersion: 'v1',
      },
      {
        kind: 'REFERRAL',
        topic: 'FINANCIAL_AID',
        templateId: 'referral.aid',
        templateVersion: 'v1',
      },
    ];
    for (const ref of refs) expect(AssistantBlockRefSchema.safeParse(ref).success).toBe(true);
  });

  it('fails a block ref that carries a payload field', () => {
    expect(
      AssistantBlockRefSchema.safeParse({ ...planRef, result: { outcome: 'PASS' } }).success,
    ).toBe(false);
    expect(
      AssistantBlockRefSchema.safeParse({
        kind: 'SCHEDULE_OPTIONS',
        shownAt: '2026-10-08T09:01:05.000-05:00',
        options: [],
      }).success,
    ).toBe(false);
  });

  it('fails an unknown kind and a bad notice code', () => {
    expect(AssistantBlockRefSchema.safeParse({ kind: 'OTHER' }).success).toBe(false);
    expect(
      AssistantBlockRefSchema.safeParse({
        kind: 'NOTICE',
        code: 'NOPE',
        templateId: 'x',
        templateVersion: 'v1',
      }).success,
    ).toBe(false);
  });
});
