/**
 * @file Proves the QA conversation fake reads a conversation's last sequence the way the
 * `@caa/db` `ConversationSequenceReader` does: it survives clear and retention, and an unowned
 * conversation reads as null.
 * @requirement FR-14
 * @requirement NFR-08
 * @see docs/standards/07-testing.md
 */
import { describe, expect, it } from 'vitest';

import type { NewConversationTurn } from '@caa/db';
import { StudentIdSchema } from '@caa/domain';
import { buildConversation, SYNTHETIC_TENANTS, syntheticId } from '@caa/test-kit';

import {
  type ConversationWorld,
  createConversationRepositories,
} from './conversation-repositories';

const TENANT_A = SYNTHETIC_TENANTS.a.id;
const TENANT_B = SYNTHETIC_TENANTS.b.id;
const OWNER = StudentIdSchema.parse(syntheticId('student', 1));
const OTHER = StudentIdSchema.parse(syntheticId('student', 2));
const CONVERSATION = buildConversation().id;
const KEEP_ALL = { retainSince: '2026-01-01T00:00:00.000-05:00', retainCount: 100 };
const EXCHANGE: readonly NewConversationTurn[] = [
  { role: 'STUDENT', text: 'What should I take?', createdAt: '2026-09-22T10:00:00.000-05:00' },
  {
    role: 'ASSISTANT',
    text: 'Here is your plan.',
    createdAt: '2026-09-22T10:01:00.000-05:00',
    blockRefs: [],
    modelStatus: 'OK',
    metadata: null,
  },
] as unknown as readonly NewConversationTurn[];

/**
 * Builds a world with the owner's conversation and no turns.
 *
 * @returns The world.
 */
function world(): ConversationWorld {
  return { conversations: [buildConversation()] };
}

/**
 * Appends the exchange to a new conversation under retention bounds.
 *
 * @param data - Backing data.
 * @param retainCount - The most turns to keep.
 * @returns Nothing.
 */
async function exchange(data: ConversationWorld, retainCount = 100): Promise<void> {
  await createConversationRepositories(data).conversations.appendTurns({
    tenantId: TENANT_A,
    studentId: OWNER,
    conversationId: CONVERSATION,
    expectedSequence: 0,
    turns: EXCHANGE,
    ...KEEP_ALL,
    retainCount,
  });
}

/**
 * Reads the last sequence.
 *
 * @param data - Backing data.
 * @param tenantId - Tenant asking.
 * @param studentId - Student asking.
 * @returns The last sequence, or null.
 */
function lastSequence(data: ConversationWorld, tenantId = TENANT_A, studentId = OWNER) {
  return createConversationRepositories(data).conversations.findLastSequence({
    tenantId,
    studentId,
    conversationId: CONVERSATION,
  });
}

describe('conversation fake last sequence', () => {
  it('is 0 for a new conversation and 2 after one exchange', async () => {
    const data = world();
    expect(await lastSequence(data)).toBe(0);
    await exchange(data);
    expect(await lastSequence(data)).toBe(2);
  });

  it('stays 2 after clear', async () => {
    const data = world();
    await exchange(data);
    await createConversationRepositories(data).conversations.clear({
      tenantId: TENANT_A,
      studentId: OWNER,
      conversationId: CONVERSATION,
    });
    expect(data.conversationTurns).toEqual([]);
    expect(await lastSequence(data)).toBe(2);
  });

  it('is unchanged after retention prunes turns', async () => {
    const data = world();
    await exchange(data, 1);
    expect(data.conversationTurns).toHaveLength(1);
    expect(await lastSequence(data)).toBe(2);
  });

  it('is null for another student, another tenant, or an unknown conversation', async () => {
    const data = world();
    await exchange(data);
    expect(await lastSequence(data, TENANT_A, OTHER)).toBeNull();
    expect(await lastSequence(data, TENANT_B, OWNER)).toBeNull();
    expect(await lastSequence({})).toBeNull();
  });
});
