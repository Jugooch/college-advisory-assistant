/**
 * @file Pure rules of a conversation turn: the turn's status and intro, the stored turns, and
 * the response. Nothing here reads a clock, a store, or a service.
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
import type { NewConversationTurn } from '@caa/db';
import { type AssistantTurnMetadata, ModelStatus, NoticeCode, TurnRole } from '@caa/domain';

import { toBlockRef } from '../conversation-blocks/conversation-blocks.logic';
import { LoopEnd } from '../conversation-loop/conversation-loop.logic';

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
