/**
 * @file Service tests of the turn store with the in-memory repository: the stale-sequence check
 * on new, cleared and full conversations, the rate-limit count, and the append with retention.
 * @requirement FR-02
 * @requirement FR-14
 * @requirement NFR-05
 * @requirement AC45
 */
import { describe, expect, it } from 'vitest';

import { ModelStatus, TermIdSchema, TurnRole } from '@caa/domain';
import {
  buildActor,
  buildConversation,
  buildStudent,
  SYNTHETIC_SCHEDULE_TERM,
  SYNTHETIC_TENANTS,
} from '@caa/test-kit';

import { NotFoundError, RevisionConflictError } from '../../shared/domain-errors';
import { createInMemoryConversationRepository } from '../../testing/in-memory-conversation-repositories';
import type { InMemoryStore } from '../../testing/in-memory-repositories';
import { buildStoredTurn } from '../../testing/stored-turns';
import { createConversationTurnStoreService } from './conversation-turn-store.service';

const NOW = new Date('2026-09-22T15:00:00.000Z');
const actor = buildActor();
const student = buildStudent({}, 1);
const conversation = buildConversation({ studentId: student.id });
const termId = TermIdSchema.parse(SYNTHETIC_SCHEDULE_TERM.termId);
const target = (expectedSequence: number) => ({ studentId: student.id, termId, expectedSequence });

function setup(options: { last?: number; log?: number; rateLimit?: number } = {}) {
  const store: InMemoryStore = {
    identities: [],
    students: [student],
    assignments: [],
    conversations: [conversation],
    conversationTurns: [],
    lastSequences: options.last === undefined ? {} : { [conversation.id]: options.last },
    studentTurnLog: Array.from({ length: options.log ?? 0 }, () => ({
      tenantId: actor.tenantId,
      studentId: student.id,
      createdAt: NOW.toISOString(),
    })),
  };
  const service = createConversationTurnStoreService({
    conversations: createInMemoryConversationRepository(store),
    now: () => NOW,
    rateLimit: options.rateLimit ?? 2,
  });
  return { store, service };
}

describe('ConversationTurnStoreService.open', () => {
  it('opens a new conversation at sequence 0', async () => {
    const opened = await setup().service.open(actor, target(0), NOW.toISOString());

    expect(opened).toMatchObject({ lastSequence: 0, recent: [] });
  });

  it('refuses a stale sequence on a new conversation', async () => {
    await expect(setup().service.open(actor, target(7), NOW.toISOString())).rejects.toThrow(
      RevisionConflictError,
    );
  });

  it('keeps the last sequence through a clear: 0 is stale, the kept value is current', async () => {
    const { service } = setup({ last: 4 });

    await expect(service.open(actor, target(0), NOW.toISOString())).rejects.toThrow(
      RevisionConflictError,
    );
    expect(await service.open(actor, target(4), NOW.toISOString())).toMatchObject({
      lastSequence: 4,
      recent: [],
    });
  });

  it('returns the newest stored turns with the last sequence', async () => {
    const { service, store } = setup();
    store.conversationTurns = [
      buildStoredTurn(1, TurnRole.Student),
      buildStoredTurn(2, TurnRole.Assistant),
    ];

    const opened = await service.open(actor, target(2), NOW.toISOString());

    expect(opened.recent.map((turn) => turn.sequence)).toEqual([1, 2]);
  });
});

describe('ConversationTurnStoreService.isOverRateLimit', () => {
  it('is over at the limit and under below it', async () => {
    expect(await setup({ log: 2 }).service.isOverRateLimit(actor, student.id)).toBe(true);
    expect(await setup({ log: 1 }).service.isOverRateLimit(actor, student.id)).toBe(false);
  });
});

describe('ConversationTurnStoreService.append', () => {
  const outcome = {
    decision: { status: ModelStatus.Answered, intro: 'Hi.', reasons: [] },
    blocks: [],
    toolNames: [],
    modelId: 'm',
  };
  const turn = (expectedSequence: number) => ({
    target: target(expectedSequence),
    conversation,
    message: 'hello',
    outcome,
    at: NOW.toISOString(),
  });

  it('stores both turns and returns the answer sequence', async () => {
    const { service, store } = setup();

    const sequence = await service.append(actor, turn(0));

    expect(sequence).toBe(2);
    expect(store.conversationTurns?.map((stored) => stored.role)).toEqual([
      TurnRole.Student,
      TurnRole.Assistant,
    ]);
    expect(store.studentTurnLog).toHaveLength(1);
  });

  it('refuses an append whose sequence went stale', async () => {
    await expect(setup({ last: 2 }).service.append(actor, turn(0))).rejects.toThrow(
      RevisionConflictError,
    );
  });

  it('is NOT_FOUND for a conversation that is not the actor’s', async () => {
    const other = buildActor({ tenantId: SYNTHETIC_TENANTS.b.id }, 9);

    await expect(setup().service.append(other, turn(0))).rejects.toThrow(NotFoundError);
  });
});
