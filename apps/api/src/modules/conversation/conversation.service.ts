/**
 * @file Runs one conversation turn for the signed-in student. The message detectors run first
 * and always add their fixed blocks; then the kill switch and the rate limit; then the bounded
 * model loop; then both turns are stored with block references only. The answer is always a
 * result with a `modelStatus`, never an error, so the planner keeps working without a model.
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
import {
  type AssistantBlock,
  type ConversationTurnRequest,
  type ConversationTurnResponse,
  MAX_TRANSCRIPT_TURNS,
} from '@caa/api-contract';
import { CrisisTier, detectFixedResponses, fallbackIntro } from '@caa/assistant';
import type { ConversationRepository } from '@caa/db';
import {
  type Actor,
  type Conversation,
  ModelStatus,
  NoticeCode,
  type SpecialistTopic,
  type StudentId,
} from '@caa/domain';

import { NotFoundError, RevisionConflictError } from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import type { AccessService } from '../access/access.service';
import {
  orderBlocks,
  policyRevisionsOf,
  type ReferralPolicy,
} from '../conversation-blocks/conversation-blocks.logic';
import {
  detectorBlocks,
  fixedNotice,
  referralTopics,
} from '../conversation-blocks/conversation-blocks.mapper';
import { LoopEnd } from '../conversation-loop/conversation-loop.logic';
import type { ConversationLoopService } from '../conversation-loop/conversation-loop.service';
import type { PolicySearchService } from '../policy-search/policy-search.service';
import {
  buildTurnsToStore,
  buildTurnView,
  RATE_LIMIT_WINDOW_MS,
  RETENTION_COUNT,
  RETENTION_MS,
  type TurnDecision,
} from './conversation.logic';
import {
  buildHistory,
  buildMetadata,
  CRISIS_DECISION,
  decideLoopTurn,
} from './conversation.mapper';

/** Dependencies of the conversation turn service. */
export interface ConversationServiceDependencies {
  readonly access: Pick<AccessService, 'canConverse'>;
  readonly conversations: ConversationRepository;
  /** The model loop, or `null` when chat is off (`CONVERSATION_MODEL=off`). */
  readonly loop: Pick<ConversationLoopService, 'run'> | null;
  /** The model's id for the turn's metadata. */
  readonly modelId: string | null;
  readonly policySearch: Pick<PolicySearchService, 'search'>;
  /** Returns the current time; the rate window and retention are judged at it. */
  readonly now: () => Date;
  /** `CONVERSATION_HISTORY_TURNS`. */
  readonly historyTurns: number;
  /** `CONVERSATION_RATE_LIMIT`: student turns per rolling 10 minutes. */
  readonly rateLimit: number;
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
   * @throws {RevisionConflictError} When `expectedSequence` is not the latest turn.
   */
  postTurn(
    actor: Actor,
    request: TurnRequest,
    context: RequestContext,
  ): Promise<ConversationTurnResponse>;
}

type Deps = ConversationServiceDependencies;

/** What every step of one turn shares. */
interface BaseScope {
  readonly deps: Deps;
  readonly actor: Actor;
  readonly request: TurnRequest;
  readonly context: RequestContext;
  /** The injected clock's instant, ISO 8601 with offset. */
  readonly at: string;
}

/** The shared scope once the detectors have run. */
interface TurnScope extends BaseScope {
  /** Blocks the message detectors added; shown at every status. */
  readonly detector: readonly AssistantBlock[];
}

/** How a turn ended and what it shows. */
interface TurnOutcome {
  readonly decision: TurnDecision;
  readonly blocks: readonly AssistantBlock[];
  readonly toolNames: readonly string[];
  readonly modelId: string | null;
}

const lookupReferrals = async (
  scope: BaseScope,
  topics: readonly SpecialistTopic[],
): Promise<Map<SpecialistTopic, ReferralPolicy>> => {
  const { deps, actor, context } = scope;
  const found = new Map<SpecialistTopic, ReferralPolicy>();
  for (const topic of topics) {
    try {
      const result = await deps.policySearch.search(actor, { topic }, context);
      const hit = result.hits.find((candidate) => candidate.topic === topic);
      if (hit !== undefined) found.set(topic, { hit, asOf: result.asOf });
    } catch {
      // NOTE: a missing referral document never blocks the fixed referral text.
      context.logger.warn({ tenantId: actor.tenantId, topic }, 'referral document unavailable');
    }
  }
  return found;
};

const isOverRateLimit = async (deps: Deps, actor: Actor, studentId: StudentId) => {
  const since = new Date(deps.now().getTime() - RATE_LIMIT_WINDOW_MS).toISOString();
  // SECURITY: counted from the turn log by the session's tenant and student, so the limit
  // holds across instances and survives a clear.
  const count = await deps.conversations.countStudentTurnsSince({
    tenantId: actor.tenantId,
    studentId,
    since,
  });
  return count >= deps.rateLimit;
};

const unstored = (scope: TurnScope, status: ModelStatus, code: NoticeCode): TurnOutcome => {
  const blocks = orderBlocks(scope.detector, [], fixedNotice(code));
  const intro = fallbackIntro(blocks.map((block) => block.kind));
  return { decision: { status, intro, reasons: [] }, blocks, toolNames: [], modelId: null };
};

const statusNotice = (end: LoopEnd): AssistantBlock | null => {
  if (end === LoopEnd.BudgetExhausted) return fixedNotice(NoticeCode.BudgetExhausted);
  return end === LoopEnd.ModelUnavailable ? fixedNotice(NoticeCode.ModelUnavailable) : null;
};

const runModel = async (
  scope: TurnScope,
  conversation: Conversation,
  runner: Pick<ConversationLoopService, 'run'>,
): Promise<TurnOutcome> => {
  const { deps, actor, request, context } = scope;
  const recent =
    deps.historyTurns > 0
      ? await deps.conversations.listRecent({
          tenantId: actor.tenantId,
          studentId: request.studentId,
          conversationId: conversation.id,
          limit: MAX_TRANSCRIPT_TURNS,
        })
      : [];
  const result = await runner.run(
    {
      actor,
      studentId: request.studentId,
      history: buildHistory(recent, deps.historyTurns),
      message: request.message,
      plannerInputs: request.plannerInputs,
    },
    context,
  );
  const blocks = orderBlocks(scope.detector, result.blocks, statusNotice(result.end));
  return {
    decision: decideLoopTurn(result, blocks),
    blocks,
    toolNames: result.toolNames,
    modelId: deps.modelId,
  };
};

const persist = async (
  scope: TurnScope,
  conversation: Conversation,
  outcome: TurnOutcome,
): Promise<number> => {
  const { deps, actor, request, at } = scope;
  const metadata = buildMetadata(
    outcome.modelId,
    outcome.decision.reasons,
    policyRevisionsOf(outcome.blocks),
  );
  const stored = await deps.conversations.appendTurns({
    // SECURITY: tenant and student come from the session and path, never the body.
    tenantId: actor.tenantId,
    studentId: request.studentId,
    conversationId: conversation.id,
    expectedSequence: request.expectedSequence,
    turns: buildTurnsToStore({
      message: request.message,
      decision: outcome.decision,
      blocks: outcome.blocks,
      metadata,
      at,
    }),
    retainSince: new Date(deps.now().getTime() - RETENTION_MS).toISOString(),
    retainCount: RETENTION_COUNT,
  });
  if (stored.status === 'SEQUENCE_CONFLICT') throw new RevisionConflictError();
  const answer = stored.status === 'APPENDED' ? stored.turns.at(-1) : undefined;
  if (answer === undefined) throw new NotFoundError();
  return answer.sequence;
};

const log = (scope: TurnScope, outcome: TurnOutcome, startedMs: number): void => {
  // SECURITY: IDs, status, tool names, guard reasons and timing only; never text (FR-14).
  scope.context.logger.info(
    {
      tenantId: scope.actor.tenantId,
      modelStatus: outcome.decision.status,
      toolNames: outcome.toolNames,
      guardReasons: outcome.decision.reasons,
      durationMs: scope.deps.now().getTime() - startedMs,
    },
    'conversation turn',
  );
};

const answerStored = async (
  scope: TurnScope,
  runner: Pick<ConversationLoopService, 'run'>,
  crisis: CrisisTier,
): Promise<TurnOutcome & { readonly sequence: number }> => {
  const { deps, actor, request, at } = scope;
  const conversation = await deps.conversations.findOrCreate({
    tenantId: actor.tenantId,
    studentId: request.studentId,
    termId: request.termId,
    now: at,
  });
  // SAFETY: tier-1 crisis language never reaches the model; the exchange is stored GUARDED
  // with no model id and is never replayed in later history.
  const outcome: TurnOutcome =
    crisis === CrisisTier.Unambiguous
      ? { decision: CRISIS_DECISION, blocks: scope.detector, toolNames: [], modelId: null }
      : await runModel(scope, conversation, runner);
  return { ...outcome, sequence: await persist(scope, conversation, outcome) };
};

/**
 * Creates the conversation turn service.
 *
 * @param dependencies - Access rule, store, model loop, policy search, clock and limits.
 * @returns A {@link ConversationService}.
 */
export function createConversationService(dependencies: Deps): ConversationService {
  const deps = dependencies;
  return {
    async postTurn(actor, request, context) {
      // SECURITY: students only; anyone else gets the NOT_FOUND of a missing student.
      if (!(await deps.access.canConverse(actor, request.studentId, context))) {
        throw new NotFoundError();
      }
      const startedMs = deps.now().getTime();
      const at = deps.now().toISOString();
      // SAFETY: the detectors run first, on the message alone, and their blocks are shown at
      // every status, including RATE_LIMITED and DISABLED (Amendment 1).
      const matches = detectFixedResponses(request.message);
      const base: BaseScope = { deps, actor, request, context, at };
      const referrals = await lookupReferrals(base, referralTopics(matches));
      const scope: TurnScope = { ...base, detector: detectorBlocks(matches, referrals, at) };
      const respond = (outcome: TurnOutcome, sequence: number | null) => {
        log(scope, outcome, startedMs);
        return { turn: buildTurnView(outcome.decision, outcome.blocks, sequence) };
      };
      // SAFETY: off is the kill switch; nothing is stored and no model is called.
      if (deps.loop === null) {
        return respond(unstored(scope, ModelStatus.Disabled, NoticeCode.Disabled), null);
      }
      if (await isOverRateLimit(deps, actor, request.studentId)) {
        return respond(unstored(scope, ModelStatus.RateLimited, NoticeCode.RateLimited), null);
      }
      const stored = await answerStored(scope, deps.loop, matches.crisis);
      return respond(stored, stored.sequence);
    },
  };
}
