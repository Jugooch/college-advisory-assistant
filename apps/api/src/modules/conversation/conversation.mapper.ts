/**
 * @file Maps between the assistant package and a conversation turn: the model's history, the
 * turn's status and fixed intro, and the metadata stored with an answer.
 * @module @caa/api/modules/conversation/conversation.mapper
 * @requirement FR-01
 * @requirement FR-10
 * @requirement FR-14
 * @requirement AC44
 * @requirement AC46
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (sections 3 and 7, Amendment 1)
 */
import type { AssistantBlock } from '@caa/api-contract';
import {
  fallbackIntro,
  GuardReason,
  type ModelMessage,
  PROMPT_VERSION,
  resolveIntro,
  TEMPLATE_VERSION,
  TOOL_SCHEMA_VERSION,
} from '@caa/assistant';
import type { StoredConversationTurn } from '@caa/db';
import {
  type AssistantTurnMetadata,
  AssistantTurnMetadataSchema,
  ModelStatus,
  type PolicyRevisionRef,
  TurnRole,
} from '@caa/domain';

import { LoopEnd, type LoopResult } from '../conversation-loop/conversation-loop.logic';
import type { TurnDecision } from './conversation.logic';

/**
 * Tells whether a stored assistant turn is a tier-1 crisis answer. A turn whose metadata can't
 * be read counts as one, so it is left out of the history rather than guessed at.
 *
 * @param turn - A stored assistant turn.
 * @returns `true` when the turn must not be replayed to the model.
 */
function isCrisisAnswer(turn: StoredConversationTurn): boolean {
  const metadata = AssistantTurnMetadataSchema.safeParse(turn.metadata);
  return !metadata.success || metadata.data.guardReasons.includes(GuardReason.CrisisUnambiguous);
}

/**
 * Builds the model's history: the student's messages and the server's intros, never model
 * text, tool results or blocks, and never a tier-1 crisis exchange.
 *
 * @param stored - The newest stored turns, oldest first.
 * @param limit - Most turns to send (`CONVERSATION_HISTORY_TURNS`).
 * @returns Messages starting with a student message.
 */
export function buildHistory(
  stored: readonly StoredConversationTurn[],
  limit: number,
): readonly ModelMessage[] {
  const omitted = new Set<number>();
  for (const turn of stored) {
    if (turn.role === TurnRole.Assistant && isCrisisAnswer(turn)) {
      // NOTE: turns are appended in pairs, so the question is the turn before the answer.
      omitted.add(turn.sequence).add(turn.sequence - 1);
    }
  }
  const eligible = stored.filter((turn) => !omitted.has(turn.sequence));
  // NOTE: slice(-0) would keep everything, so the start index is computed.
  const kept = eligible.slice(Math.max(eligible.length - Math.max(limit, 0), 0));
  const first = kept.findIndex((turn) => turn.role === TurnRole.Student);
  return (first < 0 ? [] : kept.slice(first)).map((turn): ModelMessage =>
    turn.role === TurnRole.Student
      ? { role: 'user', text: turn.text }
      : { role: 'assistant', text: turn.text, toolCalls: [] },
  );
}

/**
 * Decides a turn that ran the model loop: status and intro.
 *
 * @param result - How the loop ended.
 * @param blocks - Every block the turn shows, in display order.
 * @returns The status, a fixed intro, and why the model's reply was not used, if so.
 */
export function decideLoopTurn(
  result: LoopResult,
  blocks: readonly AssistantBlock[],
): TurnDecision {
  const kinds = blocks.map((block) => block.kind);
  if (result.end === LoopEnd.BudgetExhausted) {
    // NOTE: running out takes precedence over a guarded reply (Amendment 1).
    return { status: ModelStatus.BudgetExhausted, intro: fallbackIntro(kinds), reasons: [] };
  }
  if (result.end === LoopEnd.ModelUnavailable) {
    return { status: ModelStatus.ModelUnavailable, intro: fallbackIntro(kinds), reasons: [] };
  }
  // SAFETY: model text reaches the student only as a fixed sentence picked by a valid id.
  const resolved = resolveIntro(result.finalText, kinds);
  return {
    status: resolved.introId === null ? ModelStatus.Guarded : ModelStatus.Answered,
    intro: resolved.text,
    reasons: resolved.reasons,
  };
}

/** The decision for a tier-1 crisis turn: no model, no intro. */
export const CRISIS_DECISION: TurnDecision = {
  status: ModelStatus.Guarded,
  intro: '',
  reasons: [GuardReason.CrisisUnambiguous],
};

/**
 * Builds the metadata stored with an assistant turn. None of it enters a plan's pinned inputs.
 *
 * @param modelId - The model asked, or `null` when none was.
 * @param reasons - Why the server chose the reply.
 * @param policyRevisions - Policy revisions the turn showed.
 * @returns The metadata.
 */
export function buildMetadata(
  modelId: string | null,
  reasons: readonly string[],
  policyRevisions: readonly PolicyRevisionRef[],
): AssistantTurnMetadata {
  return {
    modelId,
    promptVersion: PROMPT_VERSION,
    toolSchemaVersion: TOOL_SCHEMA_VERSION,
    templateVersion: TEMPLATE_VERSION,
    guardReasons: reasons,
    policyRevisions,
  };
}
