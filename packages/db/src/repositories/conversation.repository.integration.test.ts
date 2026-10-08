/**
 * @file Integration tests for the conversation store: ownership, races, retention and rate-limit counts.
 */
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { ConversationId, InstitutionId, StudentId, TermId } from '@caa/domain';

import { conversationTurnTable } from '../tables/conversation.table';
import { immutableRowRejectionOf, insertTerm } from '../testing/catalog-fixtures';
import {
  insertStudent,
  insertTenant,
  openTestDatabase,
  type TestDatabase,
} from '../testing/integration-fixtures';
import {
  type ConversationRepository,
  createConversationRepository,
  type NewConversationTurn,
} from './conversation.repository';

const NOW = '2026-10-08T12:00:00.000Z';
const DAY_MS = 24 * 60 * 60 * 1000;
const METADATA = {
  modelId: null,
  promptVersion: 'p1',
  toolSchemaVersion: 't1',
  templateVersion: 'c1',
  guardReasons: [],
  policyRevisions: [],
} as const;

/**
 * Builds a student turn created at the given time.
 * @param text - Student message.
 * @param createdAt - Creation time, ISO 8601.
 * @returns The turn to append.
 */
function studentTurn(text: string, createdAt: string): NewConversationTurn {
  return { role: 'STUDENT', text, createdAt };
}

/**
 * Builds an assistant turn created at the given time.
 * @param createdAt - Creation time, ISO 8601.
 * @returns The turn to append.
 */
function assistantTurn(createdAt: string): NewConversationTurn {
  return {
    role: 'ASSISTANT',
    text: 'Here is what I found.',
    blockRefs: [{ kind: 'synthetic', note: 'opaque to the store' }] as never,
    modelStatus: 'ANSWERED',
    metadata: METADATA,
    createdAt,
  };
}

describe('conversation repository', () => {
  let testDatabase: TestDatabase;
  let repository: ConversationRepository;

  beforeAll(() => {
    testDatabase = openTestDatabase();
    repository = createConversationRepository(testDatabase.db);
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const createWorld = async (label: string) => {
    const { db } = testDatabase;
    const tenantId: InstitutionId = await insertTenant(db);
    const termId: TermId = await insertTerm(db, tenantId, { termCode: `T-${label}`, sequence: 1 });
    const studentId: StudentId = await insertStudent(db, tenantId, `S-${label}`);
    const conversation = await repository.findOrCreate({ tenantId, studentId, termId, now: NOW });
    return { tenantId, termId, studentId, conversationId: conversation.id };
  };

  const appendWith =
    (retain: { retainSince?: string; retainCount?: number }) =>
    (
      world: { tenantId: InstitutionId; studentId: StudentId; conversationId: ConversationId },
      expectedSequence: number,
      turns: readonly NewConversationTurn[],
    ) =>
      repository.appendTurns({
        ...world,
        expectedSequence,
        turns,
        retainSince: retain.retainSince ?? '2026-09-08T12:00:00.000Z',
        retainCount: retain.retainCount ?? 100,
      });
  const append = appendWith({});

  it('returns the same conversation for the same student and term', async () => {
    const world = await createWorld('find');

    const again = await repository.findOrCreate({
      tenantId: world.tenantId,
      studentId: world.studentId,
      termId: world.termId,
      now: '2026-10-09T12:00:00.000Z',
    });

    expect(again.id).toBe(world.conversationId);
    expect(again.createdAt).toBe(NOW);
  });

  it('appends a student and assistant turn and lists them oldest first', async () => {
    const world = await createWorld('append');

    const result = await append(world, 0, [studentTurn('Plan my term', NOW), assistantTurn(NOW)]);
    const listed = await repository.listRecent({ ...world, limit: 10 });

    expect(result.status).toBe('APPENDED');
    expect(listed.map((turn) => [turn.sequence, turn.role])).toEqual([
      [1, 'STUDENT'],
      [2, 'ASSISTANT'],
    ]);
    expect(listed[1]?.blockRefs).toEqual([{ kind: 'synthetic', note: 'opaque to the store' }]);
    expect(listed[1]?.modelStatus).toBe('ANSWERED');
    expect(listed[0]?.blockRefs).toBeNull();
  });

  it('limits the list to the newest turns, still oldest first', async () => {
    const world = await createWorld('limit');
    await append(world, 0, [studentTurn('one', NOW), assistantTurn(NOW)]);
    await append(world, 2, [studentTurn('two', NOW), assistantTurn(NOW)]);

    const listed = await repository.listRecent({ ...world, limit: 3 });

    expect(listed.map((turn) => turn.sequence)).toEqual([2, 3, 4]);
  });

  it('gives one success and one conflict when two appends race', async () => {
    const world = await createWorld('race');

    const results = await Promise.all([
      append(world, 0, [studentTurn('first', NOW), assistantTurn(NOW)]),
      append(world, 0, [studentTurn('second', NOW), assistantTurn(NOW)]),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'APPENDED',
      'SEQUENCE_CONFLICT',
    ]);
    expect(await repository.listRecent({ ...world, limit: 10 })).toHaveLength(2);
  });

  it('refuses a stale expected sequence', async () => {
    const world = await createWorld('stale');
    await append(world, 0, [studentTurn('one', NOW), assistantTurn(NOW)]);

    const result = await append(world, 0, [studentTurn('two', NOW), assistantTurn(NOW)]);

    expect(result.status).toBe('SEQUENCE_CONFLICT');
  });

  it('keeps a turn created exactly at the retention boundary and deletes an older one', async () => {
    const world = await createWorld('age');
    const boundary = new Date(Date.parse(NOW) - 30 * DAY_MS).toISOString();
    const older = new Date(Date.parse(boundary) - 1).toISOString();
    await appendWith({ retainSince: '2000-01-01T00:00:00.000Z' })(world, 0, [
      studentTurn('old', older),
      assistantTurn(boundary),
    ]);

    await appendWith({ retainSince: boundary })(world, 2, [
      studentTurn('new', NOW),
      assistantTurn(NOW),
    ]);
    const listed = await repository.listRecent({ ...world, limit: 10 });

    expect(listed.map((turn) => turn.sequence)).toEqual([2, 3, 4]);
  });

  it('keeps only the newest retainCount turns and never reuses a sequence', async () => {
    const world = await createWorld('count');
    await appendWith({ retainCount: 3 })(world, 0, [studentTurn('one', NOW), assistantTurn(NOW)]);
    await appendWith({ retainCount: 3 })(world, 2, [studentTurn('two', NOW), assistantTurn(NOW)]);

    const listed = await repository.listRecent({ ...world, limit: 10 });
    const next = await appendWith({ retainCount: 3 })(world, 4, [
      studentTurn('three', NOW),
      assistantTurn(NOW),
    ]);

    expect(listed.map((turn) => turn.sequence)).toEqual([2, 3, 4]);
    expect(next.status).toBe('APPENDED');
    expect((await repository.listRecent({ ...world, limit: 10 })).map((t) => t.sequence)).toEqual([
      4, 5, 6,
    ]);
  });

  it('clears the turns but keeps the conversation and its sequence', async () => {
    const world = await createWorld('clear');
    await append(world, 0, [studentTurn('one', NOW), assistantTurn(NOW)]);

    await repository.clear(world);
    const after = await append(world, 2, [studentTurn('again', NOW), assistantTurn(NOW)]);

    expect(after.status).toBe('APPENDED');
    expect((await repository.listRecent({ ...world, limit: 10 })).map((t) => t.sequence)).toEqual([
      3, 4,
    ]);
  });

  it('counts only the student turns at or after the instant', async () => {
    const world = await createWorld('count-student');
    const before = new Date(Date.parse(NOW) - 120_000).toISOString();
    const since = new Date(Date.parse(NOW) - 60_000).toISOString();
    await append(world, 0, [studentTurn('early', before), assistantTurn(before)]);
    await append(world, 2, [studentTurn('at', since), assistantTurn(NOW)]);
    await append(world, 4, [studentTurn('late', NOW), assistantTurn(NOW)]);

    const total = await repository.countStudentTurnsSince({ ...world, since });

    expect(total).toBe(2);
  });

  it('never reads, appends to or clears another tenant or student conversation', async () => {
    const owner = await createWorld('owner');
    const other = await createWorld('other');
    await append(owner, 0, [studentTurn('private', NOW), assistantTurn(NOW)]);
    const foreign = { ...owner, tenantId: other.tenantId };
    const sameTenantOtherStudent = {
      ...owner,
      studentId: await insertStudent(testDatabase.db, owner.tenantId, 'S-intruder'),
    };

    for (const caller of [foreign, sameTenantOtherStudent]) {
      expect(await repository.listRecent({ ...caller, limit: 10 })).toEqual([]);
      expect((await append(caller, 2, [studentTurn('x', NOW), assistantTurn(NOW)])).status).toBe(
        'CONVERSATION_NOT_FOUND',
      );
      await repository.clear(caller);
      expect(await repository.countStudentTurnsSince({ ...caller, since: NOW })).toBe(0);
    }
    expect(await repository.listRecent({ ...owner, limit: 10 })).toHaveLength(2);
  });

  it('refuses to update a stored turn but allows deleting one', async () => {
    const world = await createWorld('immutable');
    await append(world, 0, [studentTurn('one', NOW), assistantTurn(NOW)]);
    const { db } = testDatabase;

    await expect(
      db
        .update(conversationTurnTable)
        .set({ text: 'edited' })
        .where(eq(conversationTurnTable.conversationId, world.conversationId)),
    ).rejects.toMatchObject(immutableRowRejectionOf('conversation_turn'));
    await db
      .delete(conversationTurnTable)
      .where(eq(conversationTurnTable.conversationId, world.conversationId));
    const remaining = await db.execute(
      sql`SELECT 1 FROM conversation_turn WHERE conversation_id = ${world.conversationId}`,
    );

    expect(remaining.rows).toHaveLength(0);
  });
});
