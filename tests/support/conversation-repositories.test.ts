/**
 * @file Proves the QA conversation repository fake follows the `@caa/db` contract: one
 * conversation per student and term, owner-scoped reads, `expectedSequence` conflicts,
 * retention by age and count, clear that keeps the sequence, and a rate-limit count that
 * clearing and retention never lower.
 * @requirement FR-14
 * @requirement NFR-08
 * @see docs/standards/07-testing.md
 */
import { describe, expect, it } from 'vitest';

import type { NewConversationTurn } from '@caa/db';
import { type ConversationTurn, StudentIdSchema, TurnRole } from '@caa/domain';
import {
  buildAssistantTurn,
  buildConversation,
  buildStudentTurn,
  SYNTHETIC_TENANTS,
  syntheticId,
} from '@caa/test-kit';

import {
  type ConversationWorld,
  createConversationRepositories,
} from './conversation-repositories';

const TENANT_A = SYNTHETIC_TENANTS.a.id;
const TENANT_B = SYNTHETIC_TENANTS.b.id;
const OWNER = StudentIdSchema.parse(syntheticId('student', 1));
const OTHER = StudentIdSchema.parse(syntheticId('student', 2));
const CONVERSATION = buildConversation().id;
const NO_RETENTION = { retainSince: '2026-01-01T00:00:00.000-05:00', retainCount: 100 };
const WINDOW = '2026-09-22T00:00:00.000-05:00';

/**
 * Drops the identity fields the repository assigns.
 *
 * @param turn - A built turn.
 * @returns The same turn as a new turn.
 */
function toNew(turn: ConversationTurn): NewConversationTurn {
  return turn.role === TurnRole.Student
    ? { role: turn.role, text: turn.text, createdAt: turn.createdAt }
    : {
        role: turn.role,
        text: turn.text,
        createdAt: turn.createdAt,
        blockRefs: turn.blockRefs,
        modelStatus: turn.modelStatus,
        metadata: turn.metadata,
      };
}

/**
 * Builds a new student turn at a time.
 *
 * @param minute - Minute past 10:00 on 2026-09-22 (-05:00).
 * @returns The turn without ID, conversation or sequence.
 */
function studentAt(minute: number): NewConversationTurn {
  return toNew(buildStudentTurn({ createdAt: at(minute) }));
}

/**
 * Builds a new assistant turn at a time.
 *
 * @param minute - Minute past 10:00 on 2026-09-22 (-05:00).
 * @returns The turn without ID, conversation or sequence.
 */
function assistantAt(minute: number): NewConversationTurn {
  return toNew(buildAssistantTurn({ createdAt: at(minute) }));
}

/**
 * Formats a minute past 10:00 on 2026-09-22 (-05:00).
 *
 * @param minute - The minute.
 * @returns An ISO 8601 instant.
 */
function at(minute: number): string {
  return `2026-09-22T10:${String(minute).padStart(2, '0')}:00.000-05:00`;
}

/**
 * Builds a world with the owner's conversation and no turns.
 *
 * @returns The world.
 */
function world(): ConversationWorld {
  return { conversations: [buildConversation()] };
}

/** What to append to the owner's conversation. */
interface Send {
  readonly expectedSequence: number;
  readonly turns: readonly NewConversationTurn[];
  readonly retention: { retainSince: string; retainCount: number };
}

/**
 * Appends turns to the owner's conversation.
 *
 * @param data - Backing data.
 * @param send - The sequence the caller saw, the turns, and the retention bounds.
 * @returns The append result.
 */
function send(data: ConversationWorld, { expectedSequence, turns, retention }: Send) {
  return createConversationRepositories(data).conversations.appendTurns({
    tenantId: TENANT_A,
    studentId: OWNER,
    conversationId: CONVERSATION,
    expectedSequence,
    turns,
    ...retention,
  });
}

/**
 * Appends turns to the owner's conversation, keeping everything.
 *
 * @param data - Backing data.
 * @param expectedSequence - The sequence the caller saw.
 * @param turns - The turns to append.
 * @returns The append result.
 */
function append(
  data: ConversationWorld,
  expectedSequence: number,
  turns: readonly NewConversationTurn[],
) {
  return send(data, { expectedSequence, turns, retention: NO_RETENTION });
}

/**
 * Appends turns to a new conversation under retention bounds.
 *
 * @param data - Backing data.
 * @param turns - The turns to append.
 * @param retention - Retention bounds.
 * @returns The append result.
 */
function appendRetained(
  data: ConversationWorld,
  turns: readonly NewConversationTurn[],
  retention: Send['retention'],
) {
  return send(data, { expectedSequence: 0, turns, retention });
}

/**
 * Lists the owner's newest turns as `sequence` numbers.
 *
 * @param data - Backing data.
 * @param limit - The most turns to return.
 * @returns The sequences, oldest first.
 */
async function sequences(data: ConversationWorld, limit = 50): Promise<number[]> {
  const turns = await createConversationRepositories(data).conversations.listRecent({
    tenantId: TENANT_A,
    studentId: OWNER,
    conversationId: CONVERSATION,
    limit,
  });
  return turns.map((turn) => turn.sequence);
}

/**
 * Counts the owner's student turns since the window start.
 *
 * @param data - Backing data.
 * @param studentId - Student whose turns are counted.
 * @param tenantId - Tenant of the student.
 * @returns The count.
 */
function count(data: ConversationWorld, studentId = OWNER, tenantId = TENANT_A) {
  return createConversationRepositories(data).conversations.countStudentTurnsSince({
    tenantId,
    studentId,
    since: WINDOW,
  });
}

describe('conversation repository fake', () => {
  it('finds the same conversation for a student and term and creates one per student', async () => {
    const data: ConversationWorld = {};
    const { conversations } = createConversationRepositories(data);
    const request = {
      tenantId: TENANT_A,
      studentId: OWNER,
      termId: buildConversation().termId,
      now: '2026-09-22T10:00:00.000-05:00',
    };
    const first = await conversations.findOrCreate(request);
    expect(
      await conversations.findOrCreate({ ...request, now: '2026-09-23T10:00:00.000-05:00' }),
    ).toEqual(first);
    const other = await conversations.findOrCreate({ ...request, studentId: OTHER });
    expect(other.id).not.toBe(first.id);
    expect(data.conversations).toHaveLength(2);
  });

  it('appends numbered turns, stores student turns without model fields, and lists newest last', async () => {
    const data = world();
    const result = await append(data, 0, [studentAt(0), assistantAt(1)]);
    expect(result.status).toBe('APPENDED');
    const turns = await createConversationRepositories(data).conversations.listRecent({
      tenantId: TENANT_A,
      studentId: OWNER,
      conversationId: CONVERSATION,
      limit: 1,
    });
    expect(turns.map((turn) => [turn.sequence, turn.role])).toEqual([[2, 'ASSISTANT']]);
    expect(await sequences(data)).toEqual([1, 2]);
    expect(data.conversationTurns?.[0]).toMatchObject({
      blockRefs: null,
      modelStatus: null,
      metadata: null,
    });
  });

  it('refuses a stale expected sequence and an unowned conversation', async () => {
    const data = world();
    await append(data, 0, [studentAt(0)]);
    expect(await append(data, 0, [studentAt(1)])).toEqual({ status: 'SEQUENCE_CONFLICT' });
    const { conversations } = createConversationRepositories(data);
    for (const owner of [
      { tenantId: TENANT_A, studentId: OTHER },
      { tenantId: TENANT_B, studentId: OWNER },
    ]) {
      expect(
        await conversations.appendTurns({
          ...owner,
          conversationId: CONVERSATION,
          expectedSequence: 1,
          turns: [studentAt(2)],
          ...NO_RETENTION,
        }),
      ).toEqual({ status: 'CONVERSATION_NOT_FOUND' });
      expect(
        await conversations.listRecent({ ...owner, conversationId: CONVERSATION, limit: 5 }),
      ).toEqual([]);
    }
    expect(await sequences(data)).toEqual([1]);
  });

  it('keeps only the newest turns within the count bound', async () => {
    const data = world();
    await appendRetained(data, [studentAt(0), assistantAt(1), studentAt(2)], {
      ...NO_RETENTION,
      retainCount: 2,
    });
    expect(await sequences(data)).toEqual([2, 3]);
  });

  it('drops turns older than the age bound and keeps one created exactly then', async () => {
    const data = world();
    await appendRetained(data, [studentAt(0), assistantAt(1), studentAt(2)], {
      retainSince: '2026-09-22T10:01:00.000-05:00',
      retainCount: 100,
    });
    expect(await sequences(data)).toEqual([2, 3]);
  });

  it('clears the owner turns but keeps the sequence, and ignores a non-owner', async () => {
    const data = world();
    await append(data, 0, [studentAt(0), assistantAt(1)]);
    const { conversations } = createConversationRepositories(data);
    await conversations.clear({
      tenantId: TENANT_A,
      studentId: OTHER,
      conversationId: CONVERSATION,
    });
    expect(await sequences(data)).toEqual([1, 2]);
    await conversations.clear({
      tenantId: TENANT_A,
      studentId: OWNER,
      conversationId: CONVERSATION,
    });
    expect(await sequences(data)).toEqual([]);
    expect(await append(data, 1, [studentAt(5)])).toEqual({ status: 'SEQUENCE_CONFLICT' });
    expect((await append(data, 2, [studentAt(5)])).status).toBe('APPENDED');
    expect(await sequences(data)).toEqual([3]);
  });

  it('counts only the student turns of that student and tenant since the instant, inclusive', async () => {
    const data = world();
    await append(data, 0, [
      { ...studentAt(0), createdAt: '2026-09-21T23:59:59.999-05:00' },
      studentAt(1),
      assistantAt(2),
    ]);
    expect(await count(data)).toBe(1);
    await append(data, 3, [{ ...studentAt(3), createdAt: WINDOW }]);
    expect(await count(data)).toBe(2);
    expect(await count(data, OTHER)).toBe(0);
    expect(await count(data, OWNER, TENANT_B)).toBe(0);
  });

  it('does not lower the count when the conversation is cleared or pruned', async () => {
    const data = world();
    await appendRetained(data, [studentAt(0), studentAt(1), studentAt(2)], {
      ...NO_RETENTION,
      retainCount: 1,
    });
    expect(await sequences(data)).toEqual([3]);
    expect(await count(data)).toBe(3);
    await createConversationRepositories(data).conversations.clear({
      tenantId: TENANT_A,
      studentId: OWNER,
      conversationId: CONVERSATION,
    });
    expect(await sequences(data)).toEqual([]);
    expect(await count(data)).toBe(3);
  });
});
