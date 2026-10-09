/**
 * @file Runs one conversation turn for the signed-in student. The message detectors run first
 * and always add their fixed blocks; then the kill switch, the stale-sequence check and the
 * rate limit, all before any model call; then the answer; then both turns are stored with block
 * references only. The answer is always a result with a `modelStatus`, never an error, so the
 * planner keeps working without a model.
 * @module @caa/api/modules/conversation/conversation.service
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-08
 * @requirement FR-10
 * @requirement FR-14
 * @requirement NFR-05
 * @requirement AC43
 * @requirement AC44
 * @requirement AC45
 * @requirement AC46
 * @requirement AC47
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (sections 2, 3, 5 and 7, Amendment 1)
 */
import { type ConversationTurnRequest, type ConversationTurnResponse } from '@caa/api-contract';
import { type Actor, ModelStatus, NoticeCode, type StudentId } from '@caa/domain';

import { NotFoundError } from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import type { AccessService } from '../access/access.service';
import type { ConversationAnswerService } from '../conversation-answer/conversation-answer.service';
import type {
  ConversationBlocksService,
  DetectedBlocks,
} from '../conversation-blocks/conversation-blocks.service';
import type {
  ConversationTurnStoreService,
  OpenedConversation,
} from '../conversation-turn-store/conversation-turn-store.service';
import { buildTurnView, type TurnOutcome } from './conversation.logic';

/** Dependencies of the conversation turn service. */
export interface ConversationServiceDependencies {
  readonly access: Pick<AccessService, 'canConverse'>;
  readonly store: ConversationTurnStoreService;
  readonly blocks: Pick<ConversationBlocksService, 'detect'>;
  readonly answers: ConversationAnswerService;
  /** Returns the current time; the turn's duration is logged from it. */
  readonly now: () => Date;
}

/** A turn request: the student from the path and the validated body. */
export type TurnRequest = ConversationTurnRequest & { readonly studentId: StudentId };

/** Posts a turn. */
export interface ConversationService {
  /**
   * Answers one student message.
   *
   * @param actor - Authenticated actor from the session.
   * @param request - The student from the path and the validated body.
   * @param context - Request-scoped values.
   * @returns The assistant's turn: an intro, verified blocks and a `modelStatus`.
   * @throws {NotFoundError} When the actor isn't the student.
   * @throws {RevisionConflictError} When `expectedSequence` is not the conversation's last
   * sequence. A stale caller is refused before the rate limit and any model call, and again at
   * append when another request won.
   */
  postTurn(
    actor: Actor,
    request: TurnRequest,
    context: RequestContext,
  ): Promise<ConversationTurnResponse>;
}

/** What the steps of one turn share. */
interface TurnScope {
  readonly context: RequestContext;
  readonly detected: DetectedBlocks;
  /** The injected clock's instant, ISO 8601 with offset. */
  readonly at: string;
  /** The conversation, its last sequence and its newest turns. */
  readonly opened: OpenedConversation;
}

/** What the response to a turn is built from. */
interface TurnDone {
  readonly actor: Actor;
  readonly context: RequestContext;
  readonly startedMs: number;
  /** Returns the current time. */
  readonly now: () => Date;
  readonly outcome: TurnOutcome;
  /** The stored answer's sequence, or `null` when nothing was stored. */
  readonly sequence: number | null;
  /** The conversation's last sequence, when the turn got as far as reading it. */
  readonly lastSequence: number | undefined;
}

/**
 * Logs the turn and builds its response.
 *
 * @param done - The outcome and what the log needs.
 * @returns The response body.
 */
function finish(done: TurnDone) {
  const { actor, context, startedMs, now, outcome, sequence, lastSequence } = done;
  // SECURITY: IDs, status, tool names, guard reasons and timing only; never text (FR-14).
  context.logger.info(
    {
      tenantId: actor.tenantId,
      modelStatus: outcome.decision.status,
      toolNames: outcome.toolNames,
      guardReasons: outcome.decision.reasons,
      durationMs: now().getTime() - startedMs,
    },
    'conversation turn',
  );
  const turn = buildTurnView(outcome.decision, outcome.blocks, sequence);
  return lastSequence === undefined ? { turn } : { turn, lastSequence };
}

/**
 * Creates the conversation turn service.
 *
 * @param dependencies - Access rule, stored side, detectors, answers and clock.
 * @returns A {@link ConversationService}.
 */
export function createConversationService(
  dependencies: ConversationServiceDependencies,
): ConversationService {
  const { access, store, blocks, answers, now } = dependencies;

  const answerStored = async (actor: Actor, request: TurnRequest, scope: TurnScope) => {
    const { conversation, recent } = scope.opened;
    const { detected } = scope;
    const outcome = detected.isCrisisUnambiguous
      ? answers.crisis(detected.blocks)
      : await answers.answer(
          {
            actor,
            studentId: request.studentId,
            message: request.message,
            plannerInputs: request.plannerInputs,
            recent,
            detector: detected.blocks,
          },
          scope.context,
        );
    const turn = { target: request, conversation, message: request.message, outcome, at: scope.at };
    return { outcome, sequence: await store.append(actor, turn) };
  };

  return {
    async postTurn(actor, request, context) {
      // SECURITY: students only; anyone else gets the NOT_FOUND of a missing student.
      if (!(await access.canConverse(actor, request.studentId, context))) {
        throw new NotFoundError();
      }
      const startedMs = now().getTime();
      const at = now().toISOString();
      // SAFETY: the detectors run first, on the message alone, and their blocks are shown at
      // every status, including RATE_LIMITED and DISABLED (Amendment 1).
      const detected = await blocks.detect(actor, { message: request.message, at }, context);
      const respond = (outcome: TurnOutcome, sequence: number | null, lastSequence?: number) =>
        finish({ actor, context, startedMs, now, outcome, sequence, lastSequence });
      // SAFETY: off is the kill switch; nothing is stored and no model is called.
      if (!answers.isEnabled) {
        const off = answers.unstored(detected.blocks, ModelStatus.Disabled, NoticeCode.Disabled);
        return respond(off, null);
      }
      // SECURITY: a stale caller is refused first, so it costs neither a rate-limit slot nor a
      // model call, and the response carries the sequence to retry with.
      const opened = await store.open(actor, request, at);
      if (await store.isOverRateLimit(actor, request.studentId)) {
        const code = NoticeCode.RateLimited;
        const limited = answers.unstored(detected.blocks, ModelStatus.RateLimited, code);
        return respond(limited, null, opened.lastSequence);
      }
      const stored = await answerStored(actor, request, { context, detected, at, opened });
      return respond(stored.outcome, stored.sequence, stored.sequence);
    },
  };
}
