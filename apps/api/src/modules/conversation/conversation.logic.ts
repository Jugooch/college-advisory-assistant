/**
 * @file Pure rules of a conversation turn: the model's history window, the turn's status and
 * intro, the stale-sequence check, the stored turns, and the response. Nothing here reads a
 * clock, a store, or a service.
 * @module @caa/api/modules/conversation/conversation.logic
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-10
 * @requirement FR-14
 * @requirement NFR-05
 * @requirement AC43
 * @requirement AC44
 * @requirement AC45
 * @requirement AC46
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (sections 2, 3 and 7, Amendment 1)
 */
import type { AssistantBlock, AssistantTurnView } from '@caa/api-contract';
import type { NewConversationTurn, StoredConversationTurn } from '@caa/db';
import {
  type AssistantTurnMetadata,
  AssistantTurnMetadataSchema,
  ModelStatus,
  NoticeCode,
  TurnRole,
} from '@caa/domain';

import { toBlockRef } from '../conversation-blocks/conversation-blocks.logic';
import { LoopEnd } from '../conversation-loop/conversation-loop.logic';

/** Student turns are counted over this rolling window (ADR-0015 section 1). */
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

/** Stored turns older than this are deleted on each append (ADR-0015 section 7). */
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Only this many newest turns are kept (ADR-0015 section 7). */
export const RETENTION_COUNT = 100;

/** How a turn ended, before it is stored or returned. */
export interface TurnDecision {
  readonly status: ModelStatus;
  /** The server-written intro; `''` only for a tier-1 crisis turn. */
  readonly intro: string;
  readonly reasons: readonly string[];
}

/** How a turn ended and what it shows. */
export interface TurnOutcome {
  readonly decision: TurnDecision;
  readonly blocks: readonly AssistantBlock[];
  readonly toolNames: readonly string[];
  /** The model asked, or `null` when none was. */
  readonly modelId: string | null;
}

/** What is stored for one answered turn. */
export interface TurnToStore {
  readonly message: string;
  readonly decision: TurnDecision;
  readonly blocks: readonly AssistantBlock[];
  readonly metadata: AssistantTurnMetadata;
  /** The injected clock's instant, ISO 8601 with offset. */
  readonly at: string;
}

/**
 * Builds the two turns to append: the student's message and the assistant's answer with block
 * references only.
 *
 * @param turn - The message, the decision, the blocks, the metadata and the time.
 * @returns The student turn and the assistant turn, in that order.
 * @throws {Error} When the status is one that stores nothing.
 */
export function buildTurnsToStore(turn: TurnToStore): readonly NewConversationTurn[] {
  const { message, decision, blocks, metadata, at } = turn;
  const status = decision.status;
  if (status === ModelStatus.RateLimited || status === ModelStatus.Disabled) {
    throw new Error('A turn with this status is never stored');
  }
  return [
    { role: TurnRole.Student, text: message, createdAt: at },
    {
      role: TurnRole.Assistant,
      text: decision.intro,
      blockRefs: blocks.map((block) => toBlockRef(block, at)),
      modelStatus: status,
      metadata,
      createdAt: at,
    },
  ];
}

/**
 * Builds the response for a turn.
 *
 * @param decision - How the turn ended.
 * @param blocks - The blocks to show.
 * @param sequence - The stored assistant turn's sequence, or `null` when nothing was stored.
 * @returns The turn view.
 */
export function buildTurnView(
  decision: TurnDecision,
  blocks: readonly AssistantBlock[],
  sequence: number | null,
): AssistantTurnView {
  return { sequence, intro: decision.intro, modelStatus: decision.status, blocks };
}

/** A message in the model's history: a student message or a server-written intro. */
export type HistoryMessage =
  | { readonly role: 'user'; readonly text: string }
  | { readonly role: 'assistant'; readonly text: string; readonly toolCalls: readonly never[] };

/** A model-written reply resolved by the assistant package to a fixed sentence, or guarded. */
export interface ResolvedIntro {
  readonly text: string;
  /** The id the model named, or `null` when the reply was refused. */
  readonly introId: string | null;
  readonly reasons: readonly string[];
}

/** The intros a loop turn can show, both worked out by the assistant package. */
export interface LoopIntros {
  /** The model's final text resolved against the blocks shown. */
  readonly resolved: ResolvedIntro;
  /** The fixed intro for a turn without an answer. */
  readonly fallback: string;
}

/**
 * Decides a turn that ran the model loop: status and intro.
 *
 * @param end - How the loop ended.
 * @param intros - The resolved model intro and the fallback intro.
 * @returns The status, a fixed intro, and why the model's reply was not used, if so.
 */
export function decideLoopTurn(end: LoopEnd, intros: LoopIntros): TurnDecision {
  if (end === LoopEnd.BudgetExhausted) {
    // NOTE: running out takes precedence over a guarded reply (Amendment 1).
    return { status: ModelStatus.BudgetExhausted, intro: intros.fallback, reasons: [] };
  }
  if (end === LoopEnd.ModelUnavailable) {
    return { status: ModelStatus.ModelUnavailable, intro: intros.fallback, reasons: [] };
  }
  // SAFETY: model text reaches the student only as a fixed sentence picked by a valid id.
  const { resolved } = intros;
  return {
    status: resolved.introId === null ? ModelStatus.Guarded : ModelStatus.Answered,
    intro: resolved.text,
    reasons: resolved.reasons,
  };
}

/**
 * Decides a tier-1 crisis turn: no model, no intro.
 *
 * @param crisisReason - The guard reason recorded for tier-1 crisis language.
 * @returns A GUARDED decision with an empty intro.
 */
export function decideCrisisTurn(crisisReason: string): TurnDecision {
  return { status: ModelStatus.Guarded, intro: '', reasons: [crisisReason] };
}

/**
 * Names the notice that explains a loop end that is not an answer.
 *
 * @param end - How the loop ended.
 * @returns The notice code, or `null` when the loop ended with a reply.
 */
export function noticeForLoopEnd(end: LoopEnd): NoticeCode | null {
  if (end === LoopEnd.BudgetExhausted) return NoticeCode.BudgetExhausted;
  return end === LoopEnd.ModelUnavailable ? NoticeCode.ModelUnavailable : null;
}

/**
 * Tells whether the caller saw the newest stored turn. With nothing stored (new or cleared)
 * this can't be told here, so the locked check at append is the final guard.
 *
 * @param recent - The newest stored turns, oldest first.
 * @param expectedSequence - The sequence the caller saw.
 * @returns `false` only when a stored turn proves the caller is stale.
 */
export function isSequenceCurrent(
  recent: readonly Pick<StoredConversationTurn, 'sequence'>[],
  expectedSequence: number,
): boolean {
  const newest = recent.at(-1);
  return newest === undefined || newest.sequence === expectedSequence;
}

/**
 * Tells whether a stored assistant turn is a tier-1 crisis answer. A turn whose metadata can't
 * be read counts as one, so it is left out of the history rather than guessed at.
 *
 * @param turn - A stored assistant turn.
 * @param crisisReason - The guard reason recorded for tier-1 crisis language.
 * @returns `true` when the turn must not be replayed to the model.
 */
function isCrisisAnswer(turn: StoredConversationTurn, crisisReason: string): boolean {
  const metadata = AssistantTurnMetadataSchema.safeParse(turn.metadata);
  return !metadata.success || metadata.data.guardReasons.includes(crisisReason);
}

/**
 * Builds the model's history: the student's messages and the server's intros, never model
 * text, tool results or blocks, and never a tier-1 crisis exchange.
 *
 * @param stored - The newest stored turns, oldest first.
 * @param limit - Most turns to send (`CONVERSATION_HISTORY_TURNS`).
 * @param crisisReason - The guard reason recorded for tier-1 crisis language.
 * @returns Messages starting with a student message.
 */
export function buildHistory(
  stored: readonly StoredConversationTurn[],
  limit: number,
  crisisReason: string,
): readonly HistoryMessage[] {
  const omitted = new Set<number>();
  for (const turn of stored) {
    if (turn.role === TurnRole.Assistant && isCrisisAnswer(turn, crisisReason)) {
      // NOTE: turns are appended in pairs, so the question is the turn before the answer.
      omitted.add(turn.sequence).add(turn.sequence - 1);
    }
  }
  const eligible = stored.filter((turn) => !omitted.has(turn.sequence));
  // NOTE: slice(-0) would keep everything, so the start index is computed.
  const kept = eligible.slice(Math.max(eligible.length - Math.max(limit, 0), 0));
  const first = kept.findIndex((turn) => turn.role === TurnRole.Student);
  return (first < 0 ? [] : kept.slice(first)).map((turn): HistoryMessage =>
    turn.role === TurnRole.Student
      ? { role: 'user', text: turn.text }
      : { role: 'assistant', text: turn.text, toolCalls: [] },
  );
}
