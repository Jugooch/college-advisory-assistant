/**
 * @file Pure rules of a conversation turn: the model's history window, the turn's status and
 * intro, the stored metadata and turns, and the response. Nothing here reads a clock, a store,
 * or a service.
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
import { type AssistantTurnMetadata, ModelStatus, TurnRole } from '@caa/domain';

import { toBlockRef } from '../conversation-blocks/conversation-blocks.logic';

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
