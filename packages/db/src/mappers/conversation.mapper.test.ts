/**
 * @file Tests for the conversation and turn row mappers.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import type { ConversationRow, ConversationTurnRow } from '../tables/conversation.table';
import { toConversation, toStoredConversationTurn } from './conversation.mapper';

const CONVERSATION: ConversationRow = {
  id: '9f4e5d6c-7b8a-4f9e-a0d1-3c4d5e6f7081',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  studentId: '7e2d3c4b-5a6f-4e7d-9c8b-2b3c4d5e6f70',
  termId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  createdAt: new Date('2026-10-02T15:00:00.000Z'),
  lastSequence: 4,
};

const TURN: ConversationTurnRow = {
  id: '4d5e6f70-8192-4ca3-b4c5-d6e7f8091021',
  tenantId: CONVERSATION.tenantId,
  conversationId: CONVERSATION.id,
  sequence: 2,
  role: 'ASSISTANT',
  text: 'Here is your plan.',
  blockRefs: [{ anything: 'opaque' }],
  modelStatus: 'ANSWERED',
  metadata: { anything: 'opaque' },
  createdAt: new Date('2026-10-02T15:01:00.000Z'),
};

describe('toConversation', () => {
  it('maps a row and renders the timestamp as an ISO string', () => {
    expect(toConversation(CONVERSATION)).toEqual({
      id: CONVERSATION.id,
      tenantId: CONVERSATION.tenantId,
      studentId: CONVERSATION.studentId,
      termId: CONVERSATION.termId,
      createdAt: '2026-10-02T15:00:00.000Z',
    });
  });

  it('rejects a row whose id is not a UUID', () => {
    expect(() => toConversation({ ...CONVERSATION, id: 'nope' })).toThrow(ZodError);
  });
});

describe('toStoredConversationTurn', () => {
  it('keeps block references and metadata untouched', () => {
    const turn = toStoredConversationTurn(TURN);

    expect(turn.blockRefs).toBe(TURN.blockRefs);
    expect(turn.metadata).toBe(TURN.metadata);
    expect(turn.createdAt).toBe('2026-10-02T15:01:00.000Z');
  });

  it('maps a student turn with null JSON columns', () => {
    const turn = toStoredConversationTurn({
      ...TURN,
      role: 'STUDENT',
      blockRefs: null,
      modelStatus: null,
      metadata: null,
    });

    expect(turn).toMatchObject({ role: 'STUDENT', blockRefs: null, modelStatus: null });
  });

  it('rejects an unknown role', () => {
    expect(() => toStoredConversationTurn({ ...TURN, role: 'SYSTEM' as never })).toThrow(ZodError);
  });
});
