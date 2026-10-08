/**
 * @file Tests for the synthetic conversation turn builders.
 */
import { describe, expect, it } from 'vitest';

import { ConversationTurnSchema } from '@caa/domain';

import { buildAssistantTurn, buildStudentTurn } from './conversation-turn.builder';

describe('buildStudentTurn', () => {
  it('defaults to sequence 1 of conversation 1', () => {
    const turn = buildStudentTurn();

    expect(ConversationTurnSchema.safeParse(turn).success).toBe(true);
    expect(turn).toEqual({
      id: '13000000-0000-4000-8000-000000000001',
      conversationId: '12000000-0000-4000-8000-000000000001',
      sequence: 1,
      createdAt: '2026-09-22T10:00:00.000-05:00',
      text: 'What is the late registration process?',
      role: 'STUDENT',
    });
  });

  it('keeps the STUDENT role even when an override tries to change it', () => {
    expect(buildStudentTurn({ ...{ role: 'ASSISTANT' } } as never).role).toBe('STUDENT');
  });

  it('rejects empty text', () => {
    expect(() => buildStudentTurn({ text: '' })).toThrow();
  });
});

describe('buildAssistantTurn', () => {
  it('defaults to an answered turn, sequence 2, with one policy block and its revision', () => {
    const turn = buildAssistantTurn();

    expect(ConversationTurnSchema.safeParse(turn).success).toBe(true);
    expect(turn).toEqual({
      id: '13000000-0000-4000-8000-000000000002',
      conversationId: '12000000-0000-4000-8000-000000000001',
      sequence: 2,
      createdAt: '2026-09-22T10:00:03.000-05:00',
      text: 'Here is what the approved policy says.',
      blockRefs: [
        { kind: 'POLICY_RESULTS', documents: [{ documentKey: 'late-registration', revision: 1 }] },
      ],
      modelStatus: 'ANSWERED',
      metadata: {
        modelId: 'synthetic-model-1',
        promptVersion: 'prompt-1',
        toolSchemaVersion: 'tools-1',
        templateVersion: 'templates-1',
        guardReasons: [],
        policyRevisions: [{ documentKey: 'late-registration', revision: 1 }],
      },
      role: 'ASSISTANT',
    });
  });

  it('lets an override win', () => {
    expect(buildAssistantTurn({ modelStatus: 'GUARDED' }, 4)).toMatchObject({
      id: '13000000-0000-4000-8000-000000000004',
      modelStatus: 'GUARDED',
    });
  });

  it('rejects a stored status the model never stores', () => {
    expect(() => buildAssistantTurn({ modelStatus: 'DISABLED' as never })).toThrow();
  });
});
