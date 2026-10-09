/**
 * @file Pure rules of how a turn ends: the status and fixed intro of a loop turn or a crisis turn,
 * and the notice that explains a loop end that is not an answer.
 * @module @caa/api/modules/conversation-answer/conversation-answer.logic
 * @requirement FR-01
 * @requirement FR-10
 * @requirement NFR-05
 * @requirement AC44
 * @requirement AC46
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (sections 2 and 3, Amendment 1)
 */
import type { AssistantBlock } from '@caa/api-contract';
import { ModelStatus, NoticeCode } from '@caa/domain';

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
