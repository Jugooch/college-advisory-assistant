/**
 * @file Service tests for the transcript with injected fakes: availability from configuration,
 * the newest 100 turns, clear without resetting the rate-limit log, the student-only access
 * matrix, and logs without text.
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-14
 * @requirement NFR-05
 * @requirement NFR-08
 * @requirement AC45
 * @requirement AC46
 */
import { describe, expect, it } from 'vitest';

import { MAX_TRANSCRIPT_TURNS } from '@caa/api-contract';
import type { StoredConversationTurn } from '@caa/db';
import { type Actor, ModelStatus, NoticeCode, Role, TermIdSchema, TurnRole } from '@caa/domain';
import {
  buildActor,
  buildConversation,
  buildStudent,
  SYNTHETIC_SCHEDULE_TERM,
  SYNTHETIC_TENANTS,
  syntheticId,
} from '@caa/test-kit';

import { NotFoundError } from '../../shared/domain-errors';
import { createInMemoryConversationRepository } from '../../testing/in-memory-conversation-repositories';
import {
  createInMemoryRepositories,
  createRecordingLogger,
  type InMemoryStore,
} from '../../testing/in-memory-repositories';
import { createAccessService } from '../access/access.service';
import { createConversationStoreService } from './conversation-store.service';

const NOW = new Date('2026-09-22T15:00:00.000Z');
const TEXT = 'My synthetic question about late registration.';
const studentActor = buildActor({ roles: [Role.Student] }, 1);
const advisorActor = buildActor({ roles: [Role.Advisor] }, 2);
const adminActor = buildActor({ roles: [Role.Admin] }, 4);
const tenantBActor = buildActor({ tenantId: SYNTHETIC_TENANTS.b.id, roles: [Role.Student] }, 1);
const ownStudent = buildStudent({ userId: studentActor.userId }, 1);
const otherStudent = buildStudent({}, 2);
const query = { termId: TermIdSchema.parse(SYNTHETIC_SCHEDULE_TERM.termId) };

function turn(sequence: number, role: TurnRole = TurnRole.Student): StoredConversationTurn {
  return {
    id: syntheticId('conversationTurn', sequence) as StoredConversationTurn['id'],
    conversationId: buildConversation().id,
    sequence,
    role,
    text: TEXT,
    blockRefs: role === TurnRole.Assistant ? [] : null,
    modelStatus: role === TurnRole.Assistant ? ModelStatus.Answered : null,
    metadata: null,
    createdAt: NOW.toISOString(),
  };
}

function setup(options: { isAvailable?: boolean; turns?: readonly StoredConversationTurn[] } = {}) {
  const store: InMemoryStore = {
    identities: [],
    students: [ownStudent, otherStudent],
    assignments: [],
    conversations: [buildConversation({ studentId: ownStudent.id })],
    conversationTurns: options.turns ?? [],
    studentTurnLog: [
      { tenantId: ownStudent.tenantId, studentId: ownStudent.id, createdAt: NOW.toISOString() },
    ],
  };
  const repositories = createInMemoryRepositories(store);
  const logger = createRecordingLogger();
  const service = createConversationStoreService({
    access: createAccessService({ ...repositories, now: () => NOW }),
    conversations: createInMemoryConversationRepository(store),
    now: () => NOW,
    isAvailable: options.isAvailable ?? true,
  });
  const get = (actor: Actor, studentId = ownStudent.id) =>
    service.getConversation(actor, { studentId, ...query }, { logger });
  const clear = (actor: Actor, studentId = ownStudent.id) =>
    service.clearConversation(actor, { studentId, ...query }, { logger });
  return { store, logger, get, clear };
}

describe('ConversationStoreService.getConversation', () => {
  it('returns an available, empty transcript when nothing is stored', async () => {
    expect(await setup().get(studentActor)).toEqual({
      available: true,
      unavailableReason: null,
      turns: [],
      lastSequence: 0,
    });
  });

  it('says chat is off, with the reason, and still returns the stored turns', async () => {
    const result = await setup({ isAvailable: false, turns: [turn(1)] }).get(studentActor);

    expect(result.available).toBe(false);
    expect(result.unavailableReason).toBe(NoticeCode.Disabled);
    expect(result.turns).toHaveLength(1);
  });

  it('returns only the newest 100 turns, oldest first', async () => {
    const turns = Array.from({ length: 120 }, (_, index) => turn(index + 1));

    const result = await setup({ turns }).get(studentActor);

    expect(result.turns).toHaveLength(MAX_TRANSCRIPT_TURNS);
    expect(result.turns[0]?.sequence).toBe(21);
    expect(result.turns.at(-1)?.sequence).toBe(120);
  });

  it('returns the last sequence after a clear, with no turns', async () => {
    const { get, clear, store } = setup({ turns: [turn(1), turn(2, TurnRole.Assistant)] });

    await clear(studentActor);
    const result = await get(studentActor);

    expect(result.turns).toEqual([]);
    expect(result.lastSequence).toBe(2);
    expect(store.lastSequences).toBeDefined();
  });

  it('logs a count and opaque IDs, never turn text', async () => {
    const { get, logger } = setup({ turns: [turn(1), turn(2, TurnRole.Assistant)] });

    await get(studentActor);

    expect(JSON.stringify(logger.entries)).not.toContain(TEXT);
    expect(logger.entries.find((entry) => entry.message === 'conversation read')?.details).toEqual({
      tenantId: ownStudent.tenantId,
      conversationId: buildConversation().id,
      turnCount: 2,
    });
  });

  it('logs the sequences of unreadable turns, never their content', async () => {
    const { get, logger } = setup({
      turns: [{ ...turn(1, TurnRole.Assistant), blockRefs: [{ kind: 'RETIRED', text: TEXT }] }],
    });

    await get(studentActor);

    const warning = logger.entries.find((entry) => entry.level === 'warn');
    expect(warning?.details).toMatchObject({ unreadableSequences: [1] });
    expect(JSON.stringify(logger.entries)).not.toContain(TEXT);
  });
});

describe('ConversationStoreService access', () => {
  it.each([
    ['an assigned advisor', advisorActor, ownStudent.id],
    ['an admin of the same tenant', adminActor, ownStudent.id],
    ['another student', studentActor, otherStudent.id],
    ['a student of another tenant', tenantBActor, ownStudent.id],
    ['a student that does not exist', studentActor, buildStudent({}, 99).id],
  ])('refuses %s with NOT_FOUND on read and clear', async (_case, actor, studentId) => {
    const { get, clear, store } = setup({ turns: [turn(1)] });

    await expect(get(actor, studentId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(clear(actor, studentId)).rejects.toBeInstanceOf(NotFoundError);
    expect(store.conversationTurns).toHaveLength(1);
  });

  it('finds the conversation by the session tenant, student and term', async () => {
    const { get, store } = setup({ turns: [turn(1)] });
    store.conversations = [
      ...(store.conversations ?? []),
      buildConversation({ studentId: ownStudent.id, termId: syntheticId('term', 9) }, 2),
    ];

    expect((await get(studentActor)).turns).toHaveLength(1);
  });
});

describe('ConversationStoreService.clearConversation', () => {
  it('empties the transcript and keeps the rate-limit log', async () => {
    const { get, clear, store } = setup({ turns: [turn(1), turn(2, TurnRole.Assistant)] });

    await clear(studentActor);

    expect((await get(studentActor)).turns).toEqual([]);
    expect(store.studentTurnLog).toHaveLength(1);
  });

  it('logs the clear without turn text', async () => {
    const { clear, logger } = setup({ turns: [turn(1)] });

    await clear(studentActor);

    expect(logger.entries.map((entry) => entry.message)).toContain('conversation cleared');
    expect(JSON.stringify(logger.entries)).not.toContain(TEXT);
  });
});
