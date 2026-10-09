/**
 * @file Reads and clears a student's conversation transcript. Only the student may; the stored
 * turns hold block references, never past results.
 * @module @caa/api/modules/conversation-store/conversation-store.service
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-14
 * @requirement NFR-05
 * @requirement NFR-08
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (sections 1 and 7)
 */
import {
  type ConversationQuery,
  type ConversationResponse,
  MAX_TRANSCRIPT_TURNS,
} from '@caa/api-contract';
import type {
  ConversationRepository,
  ConversationSequenceReader,
  FindLastSequenceRequest,
} from '@caa/db';
import { type Actor, NoticeCode, type StudentId } from '@caa/domain';

import { NotFoundError } from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import type { AccessService } from '../access/access.service';
import { toTranscriptTurns } from './conversation-store.logic';

/** Dependencies of the conversation store service. */
export interface ConversationStoreServiceDependencies {
  readonly access: Pick<AccessService, 'canConverse'>;
  readonly conversations: ConversationRepository & ConversationSequenceReader;
  /** Returns the current time. */
  readonly now: () => Date;
  /** True unless `CONVERSATION_MODEL=off`. */
  readonly isAvailable: boolean;
}

/** Which conversation: the student from the path and the term from the query. */
export interface ConversationTarget {
  readonly studentId: StudentId;
  readonly termId: ConversationQuery['termId'];
}

/** Transcript reads and clears. */
export interface ConversationStoreService {
  /**
   * Returns availability and the newest stored turns of the student's conversation for a term.
   *
   * @param actor - Authenticated actor from the session.
   * @param target - The student from the path and the term from the query.
   * @param context - Request-scoped values.
   * @returns The transcript, empty when nothing is stored, and the conversation's last
   * sequence, which a client sends as `expectedSequence` and which a clear leaves alone.
   * @throws {NotFoundError} When the actor isn't the student.
   */
  getConversation(
    actor: Actor,
    target: ConversationTarget,
    context: RequestContext,
  ): Promise<ConversationResponse>;

  /**
   * Deletes the stored turns. The rate-limit log is separate and is not reset.
   *
   * @param actor - Authenticated actor from the session.
   * @param target - The student from the path and the term from the query.
   * @param context - Request-scoped values.
   * @throws {NotFoundError} When the actor isn't the student.
   */
  clearConversation(
    actor: Actor,
    target: ConversationTarget,
    context: RequestContext,
  ): Promise<void>;
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
 * Warns about stored turns that could not be read.
 *
 * @param context - Request-scoped values.
 * @param read - The tenant and conversation read, and the sequences of the turns left out.
 */
function logUnreadable(
  context: RequestContext,
  read: {
    readonly tenantId: string;
    readonly conversationId: string;
    readonly unreadableSequences: readonly number[];
  },
): void {
  const { tenantId, conversationId, unreadableSequences } = read;
  if (unreadableSequences.length === 0) return;
  // SECURITY: IDs and sequence numbers only; no turn text (FR-14).
  context.logger.warn(
    { tenantId, conversationId, unreadableSequences },
    'stored conversation turns could not be read',
  );
}

/**
 * Creates the conversation store service.
 *
 * @param dependencies - Access rule, conversation repository, clock, and availability.
 * @returns A {@link ConversationStoreService}.
 */
export function createConversationStoreService(
  dependencies: ConversationStoreServiceDependencies,
): ConversationStoreService {
  const { access, conversations, now, isAvailable } = dependencies;

  const open = async (actor: Actor, target: ConversationTarget, context: RequestContext) => {
    // SECURITY: students only; an advisor, admin, other student or other tenant gets the same
    // NOT_FOUND as a missing student (ADR-0015 section 7).
    if (!(await access.canConverse(actor, target.studentId, context))) {
      throw new NotFoundError();
    }
    // SECURITY: tenant and student come from the session and path; the conversation is found
    // by tenant, student and term.
    return conversations.findOrCreate({
      tenantId: actor.tenantId,
      studentId: target.studentId,
      termId: target.termId,
      now: now().toISOString(),
    });
  };

  return {
    async getConversation(actor, target, context) {
      const conversation = await open(actor, target, context);
      const lastSequence = await requireLastSequence(conversations, {
        tenantId: actor.tenantId,
        studentId: target.studentId,
        conversationId: conversation.id,
      });
      const stored = await conversations.listRecent({
        tenantId: actor.tenantId,
        studentId: target.studentId,
        conversationId: conversation.id,
        limit: MAX_TRANSCRIPT_TURNS,
      });
      const { turns, unreadableSequences } = toTranscriptTurns(stored);
      logUnreadable(context, {
        tenantId: actor.tenantId,
        conversationId: conversation.id,
        unreadableSequences,
      });
      context.logger.info(
        { tenantId: actor.tenantId, conversationId: conversation.id, turnCount: turns.length },
        'conversation read',
      );
      return {
        available: isAvailable,
        unavailableReason: isAvailable ? null : NoticeCode.Disabled,
        turns,
        lastSequence,
      };
    },

    async clearConversation(actor, target, context) {
      const conversation = await open(actor, target, context);
      await conversations.clear({
        tenantId: actor.tenantId,
        studentId: target.studentId,
        conversationId: conversation.id,
      });
      context.logger.info(
        { tenantId: actor.tenantId, conversationId: conversation.id },
        'conversation cleared',
      );
    },
  };
}
