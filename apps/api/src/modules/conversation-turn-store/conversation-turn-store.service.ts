/**
 * @file Reads and writes a turn's stored side: the rate-limit count, the conversation with its
 * newest turns and the stale-sequence check, and the append with the retention bounds.
 * @module @caa/api/modules/conversation-turn-store/conversation-turn-store.service
 * @requirement FR-02
 * @requirement FR-14
 * @requirement NFR-05
 * @requirement AC45
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (sections 2 and 7)
 */
import { MAX_TRANSCRIPT_TURNS } from '@caa/api-contract';
import type {
  ConversationRepository,
  ConversationSequenceReader,
  FindLastSequenceRequest,
  StoredConversationTurn,
} from '@caa/db';
import type { Actor, Conversation, StudentId, TermId } from '@caa/domain';

import { NotFoundError, RevisionConflictError } from '../../shared/domain-errors';
import { buildTurnsToStore, type TurnOutcome } from '../conversation/conversation.logic';
import { buildMetadata } from '../conversation/conversation.mapper';
import { policyRevisionsOf } from '../conversation-blocks/conversation-blocks.logic';
import {
  isSequenceCurrent,
  RATE_LIMIT_WINDOW_MS,
  RETENTION_COUNT,
  RETENTION_MS,
} from './conversation-turn-store.logic';

/** Dependencies of the turn store service. */
export interface ConversationTurnStoreServiceDependencies {
  readonly conversations: ConversationRepository & ConversationSequenceReader;
  /** Returns the current time; the rate window and retention are judged at it. */
  readonly now: () => Date;
  /** `CONVERSATION_RATE_LIMIT`: student turns per rolling 10 minutes. */
  readonly rateLimit: number;
}

/** Which conversation a turn belongs to, and the sequence the caller saw. */
export interface TurnTarget {
  readonly studentId: StudentId;
  readonly termId: TermId;
  readonly expectedSequence: number;
}

/** The conversation, its last sequence, and its newest turns. */
export interface OpenedConversation {
  readonly conversation: Conversation;
  /** The stored last sequence, which a clear and retention leave alone. */
  readonly lastSequence: number;
  readonly recent: readonly StoredConversationTurn[];
}

/** What one answered turn stores. */
export interface TurnToAppend {
  readonly target: TurnTarget;
  readonly conversation: Conversation;
  readonly message: string;
  readonly outcome: TurnOutcome;
  /** The injected clock's instant, ISO 8601 with offset. */
  readonly at: string;
}

/** The stored side of a turn. */
export interface ConversationTurnStoreService {
  /**
   * Tells whether the student is past the rate limit.
   *
   * @param actor - Authenticated actor from the session.
   * @param studentId - The student from the path.
   * @returns `true` when the rolling window already holds the limit.
   */
  isOverRateLimit(actor: Actor, studentId: StudentId): Promise<boolean>;

  /**
   * Finds or creates the conversation, refuses a caller whose `expectedSequence` is not its
   * stored last sequence, and reads its newest turns. This runs before the rate limit and any
   * model call, for a new or cleared conversation too.
   *
   * @param actor - Authenticated actor from the session.
   * @param target - The student, the term and the sequence the caller saw.
   * @param at - The instant to create the conversation at.
   * @returns The conversation, its last sequence and its newest turns, oldest first.
   * @throws {RevisionConflictError} When the caller is stale.
   * @throws {NotFoundError} When the conversation isn't the actor's.
   */
  open(actor: Actor, target: TurnTarget, at: string): Promise<OpenedConversation>;

  /**
   * Appends the student's message and the answer, applying retention.
   *
   * @param actor - Authenticated actor from the session.
   * @param turn - The target, the message, the outcome and the time.
   * @returns The stored answer's sequence.
   * @throws {RevisionConflictError} When another request appended first.
   * @throws {NotFoundError} When the conversation isn't the actor's.
   */
  append(actor: Actor, turn: TurnToAppend): Promise<number>;
}

/**
 * Reads the conversation's last sequence.
 *
 * @param conversations - The sequence reader.
 * @param request - Tenant and student from the session and path, and the conversation.
 * @returns The last sequence.
 * @throws {NotFoundError} When the conversation isn't the owner's.
 */
async function requireLastSequence(
  conversations: ConversationSequenceReader,
  request: FindLastSequenceRequest,
): Promise<number> {
  const lastSequence = await conversations.findLastSequence(request);
  if (lastSequence === null) throw new NotFoundError();
  return lastSequence;
}

/**
 * Appends the student's message and the answer, applying retention.
 *
 * @param dependencies - The repository and the clock.
 * @param actor - Authenticated actor from the session.
 * @param turn - The target, the message, the outcome and the time.
 * @returns The stored answer's sequence.
 * @throws {RevisionConflictError} When another request appended first.
 * @throws {NotFoundError} When the conversation isn't the actor's.
 */
async function appendTurn(
  dependencies: Pick<ConversationTurnStoreServiceDependencies, 'conversations' | 'now'>,
  actor: Actor,
  turn: TurnToAppend,
): Promise<number> {
  const { conversations, now } = dependencies;
  const { target, conversation, message, outcome, at } = turn;
  const metadata = buildMetadata(
    outcome.modelId,
    outcome.decision.reasons,
    policyRevisionsOf(outcome.blocks),
  );
  const stored = await conversations.appendTurns({
    tenantId: actor.tenantId,
    studentId: target.studentId,
    conversationId: conversation.id,
    expectedSequence: target.expectedSequence,
    turns: buildTurnsToStore({
      message,
      decision: outcome.decision,
      blocks: outcome.blocks,
      metadata,
      at,
    }),
    retainSince: new Date(now().getTime() - RETENTION_MS).toISOString(),
    retainCount: RETENTION_COUNT,
  });
  if (stored.status === 'SEQUENCE_CONFLICT') throw new RevisionConflictError();
  const answer = stored.status === 'APPENDED' ? stored.turns.at(-1) : undefined;
  if (answer === undefined) throw new NotFoundError();
  return answer.sequence;
}

/**
 * Creates the turn store service.
 *
 * @param dependencies - The conversation repository, the clock and the rate limit.
 * @returns A {@link ConversationTurnStoreService}.
 */
export function createConversationTurnStoreService(
  dependencies: ConversationTurnStoreServiceDependencies,
): ConversationTurnStoreService {
  const { conversations, now, rateLimit } = dependencies;
  return {
    async isOverRateLimit(actor, studentId) {
      const since = new Date(now().getTime() - RATE_LIMIT_WINDOW_MS).toISOString();
      // SECURITY: counted from the turn log by the session's tenant and student, so the limit
      // holds across instances and survives a clear.
      const count = await conversations.countStudentTurnsSince({
        tenantId: actor.tenantId,
        studentId,
        since,
      });
      return count >= rateLimit;
    },

    async open(actor, target, at) {
      // SECURITY: tenant and student come from the session and path, never the body.
      const conversation = await conversations.findOrCreate({
        tenantId: actor.tenantId,
        studentId: target.studentId,
        termId: target.termId,
        now: at,
      });
      const lastSequence = await requireLastSequence(conversations, {
        tenantId: actor.tenantId,
        studentId: target.studentId,
        conversationId: conversation.id,
      });
      // SECURITY: a stale caller is refused here, before the rate limit and the model, even on
      // a new or cleared conversation, so a wrong sequence can neither burn model calls nor
      // dodge the limit (which counts stored turns).
      if (!isSequenceCurrent(lastSequence, target.expectedSequence)) {
        throw new RevisionConflictError();
      }
      const recent = await conversations.listRecent({
        tenantId: actor.tenantId,
        studentId: target.studentId,
        conversationId: conversation.id,
        limit: MAX_TRANSCRIPT_TURNS,
      });
      return { conversation, lastSequence, recent };
    },

    append: (actor, turn) => appendTurn({ conversations, now }, actor, turn),
  };
}
