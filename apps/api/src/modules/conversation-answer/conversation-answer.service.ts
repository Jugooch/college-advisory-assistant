/**
 * @file Decides how one turn is answered once it may proceed: tier-1 crisis language gets the
 * fixed crisis answer with no model, the kill switch and rate limit get a fixed notice, and
 * anything else runs the bounded model loop and resolves its reply to a fixed intro.
 * @module @caa/api/modules/conversation-answer/conversation-answer.service
 * @requirement FR-01
 * @requirement FR-10
 * @requirement FR-14
 * @requirement AC44
 * @requirement AC46
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (sections 3 and 7, Amendment 1)
 */
import type { AssistantBlock, ScheduleOptionsRequest } from '@caa/api-contract';
import { fallbackIntro, GuardReason, resolveIntro } from '@caa/assistant';
import type { StoredConversationTurn } from '@caa/db';
import { type Actor, type ModelStatus, type NoticeCode, type StudentId } from '@caa/domain';

import type { RequestContext } from '../../shared/request-context';
import { orderBlocks } from '../conversation-blocks/conversation-blocks.logic';
import { fixedNotice } from '../conversation-blocks/conversation-blocks.mapper';
import { buildHistory } from '../conversation-history/conversation-history.logic';
import type { ConversationLoopService } from '../conversation-loop/conversation-loop.service';
import {
  decideCrisisTurn,
  decideLoopTurn,
  noticeForLoopEnd,
  type TurnOutcome,
} from './conversation-answer.logic';

/** Dependencies of the answer service. */
export interface ConversationAnswerServiceDependencies {
  /** The model loop, or `null` when chat is off (`CONVERSATION_MODEL=off`). */
  readonly loop: Pick<ConversationLoopService, 'run'> | null;
  /** The model's id for the turn's metadata. */
  readonly modelId: string | null;
  /** `CONVERSATION_HISTORY_TURNS`. */
  readonly historyTurns: number;
}

/** What a model turn needs. */
export interface ModelTurnInput {
  readonly actor: Actor;
  readonly studentId: StudentId;
  readonly message: string;
  readonly plannerInputs?: ScheduleOptionsRequest | undefined;
  /** The newest stored turns, oldest first. */
  readonly recent: readonly StoredConversationTurn[];
  /** Blocks the message detectors added; shown at every status. */
  readonly detector: readonly AssistantBlock[];
}

/** Answers a turn. */
export interface ConversationAnswerService {
  /** Whether chat is on; `false` is the kill switch. */
  readonly isEnabled: boolean;
  /**
   * The outcome of a turn that stores nothing: the detector blocks plus one notice.
   *
   * @param detector - Blocks the message detectors added.
   * @param status - `DISABLED` or `RATE_LIMITED`.
   * @param code - The notice that explains the status.
   * @returns The outcome.
   */
  unstored(detector: readonly AssistantBlock[], status: ModelStatus, code: NoticeCode): TurnOutcome;
  /**
   * The outcome of tier-1 crisis language: only the detector blocks, no model.
   *
   * @param detector - Blocks the message detectors added.
   * @returns The outcome, GUARDED with no model id.
   */
  crisis(detector: readonly AssistantBlock[]): TurnOutcome;
  /**
   * Runs the model loop and resolves its reply.
   *
   * @param input - The student's message, the stored history and the detector blocks.
   * @param context - Request-scoped values.
   * @returns The outcome; a model failure is a status, never an error.
   * @throws {Error} When chat is off; callers check `isEnabled` first.
   */
  answer(input: ModelTurnInput, context: RequestContext): Promise<TurnOutcome>;
}

/**
 * Creates the answer service.
 *
 * @param dependencies - The model loop, its id and the history window.
 * @returns A {@link ConversationAnswerService}.
 */
export function createConversationAnswerService(
  dependencies: ConversationAnswerServiceDependencies,
): ConversationAnswerService {
  const { loop, modelId, historyTurns } = dependencies;
  return {
    isEnabled: loop !== null,
    unstored(detector, status, code) {
      const blocks = orderBlocks(detector, [], fixedNotice(code));
      const intro = fallbackIntro(blocks.map((block) => block.kind));
      return { decision: { status, intro, reasons: [] }, blocks, toolNames: [], modelId: null };
    },
    crisis(detector) {
      // SAFETY: tier-1 crisis language never reaches the model; the exchange is stored GUARDED
      // with no model id and is never replayed in later history.
      return {
        decision: decideCrisisTurn(GuardReason.CrisisUnambiguous),
        blocks: detector,
        toolNames: [],
        modelId: null,
      };
    },
    async answer(input, context) {
      if (loop === null) throw new Error('The model loop is off');
      const result = await loop.run(
        {
          actor: input.actor,
          studentId: input.studentId,
          history: buildHistory(input.recent, historyTurns, GuardReason.CrisisUnambiguous),
          message: input.message,
          plannerInputs: input.plannerInputs,
        },
        context,
      );
      const code = noticeForLoopEnd(result.end);
      const blocks = orderBlocks(
        input.detector,
        result.blocks,
        code === null ? null : fixedNotice(code),
      );
      const kinds = blocks.map((block) => block.kind);
      const decision = decideLoopTurn(result.end, {
        resolved: resolveIntro(result.finalText, kinds),
        fallback: fallbackIntro(kinds),
      });
      return { decision, blocks, toolNames: result.toolNames, modelId };
    },
  };
}
