/**
 * @file Proves the QA conversation repository fake stays consistent when a case seeds data by
 * hand: new conversation IDs never collide with seeded ones, and turn IDs and sequences stay
 * unique when turns are seeded without a matching last-sequence record.
 * @requirement FR-14
 * @see docs/standards/07-testing.md
 */
import { describe, expect, it } from 'vitest';

import type { NewConversationTurn, StoredConversationTurn } from '@caa/db';
import { type ConversationTurn, StudentIdSchema } from '@caa/domain';
import { buildConversation, buildStudentTurn, SYNTHETIC_TENANTS, syntheticId } from '@caa/test-kit';

import {
  type ConversationWorld,
  createConversationRepositories,
} from './conversation-repositories';

const TENANT_A = SYNTHETIC_TENANTS.a.id;
const OWNER = StudentIdSchema.parse(syntheticId('student', 1));
const OTHER = StudentIdSchema.parse(syntheticId('student', 2));
const RETENTION = { retainSince: '2026-01-01T00:00:00.000-05:00', retainCount: 100 };
const NEW_TURN: NewConversationTurn = {
  role: 'STUDENT',
  text: 'What should I take next term?',
  createdAt: '2026-09-22T10:01:00.000-05:00',
};

/**
 * Gives a built student turn the stored shape, with no model fields.
 *
 * @param turn - A built student turn.
 * @returns The stored turn.
 */
function stored(turn: ConversationTurn): StoredConversationTurn {
  return { ...turn, blockRefs: null, modelStatus: null, metadata: null };
}

describe('conversation repository fake with seeded data', () => {
  it('gives a new conversation an id that no seeded conversation uses', async () => {
    const seeded = buildConversation({ studentId: OTHER }, 2);
    const data: ConversationWorld = {
      conversations: [seeded],
      conversationTurns: [stored(buildStudentTurn({ conversationId: seeded.id }))],
      conversationLastSequences: { [seeded.id]: 1 },
    };
    const repository = createConversationRepositories(data).conversations;
    const created = await repository.findOrCreate({
      tenantId: TENANT_A,
      studentId: OWNER,
      termId: seeded.termId,
      now: '2026-09-22T10:00:00.000-05:00',
    });
    expect(created.id).not.toBe(seeded.id);
    const visible = await repository.listRecent({
      tenantId: TENANT_A,
      studentId: OWNER,
      conversationId: created.id,
      limit: 10,
    });
    expect(visible).toEqual([]);
  });

  it('keeps turn ids and sequences consistent when turns are seeded without a record', async () => {
    const conversation = buildConversation();
    const data: ConversationWorld = {
      conversations: [conversation],
      conversationTurns: [stored(buildStudentTurn({}, 1))],
    };
    const append = (expectedSequence: number) =>
      createConversationRepositories(data).conversations.appendTurns({
        tenantId: TENANT_A,
        studentId: OWNER,
        conversationId: conversation.id,
        expectedSequence,
        turns: [NEW_TURN],
        ...RETENTION,
      });
    expect((await append(0)).status).toBe('SEQUENCE_CONFLICT');
    expect((await append(1)).status).toBe('APPENDED');
    const turns = data.conversationTurns ?? [];
    expect(turns.map((turn) => turn.sequence)).toEqual([1, 2]);
    expect(new Set(turns.map((turn) => turn.id)).size).toBe(2);
  });
});
