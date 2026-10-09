/**
 * @file Pure rules of a turn's stored side: the rate-limit window, the retention bounds, the
 * stale-sequence check, and the turns to append.
 * @module @caa/api/modules/conversation-turn-store/conversation-turn-store.logic
 * @requirement FR-02
 * @requirement FR-14
 * @requirement NFR-05
 * @requirement AC45
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (sections 2 and 7)
 */
import type { AssistantBlock } from '@caa/api-contract';
import type { NewConversationTurn } from '@caa/db';
import { type AssistantTurnMetadata, ModelStatus, TurnRole } from '@caa/domain';

import type { TurnDecision } from '../conversation-answer/conversation-answer.logic';
import { toBlockRef } from '../conversation-blocks/conversation-blocks.logic';

/** Student turns are counted over this rolling window (ADR-0015 section 1). */
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

/** Stored turns older than this are deleted on each append (ADR-0015 section 7). */
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Only this many newest turns are kept (ADR-0015 section 7). */
export const RETENTION_COUNT = 100;

/**
 * Tells whether the caller saw the conversation's last sequence. The last sequence survives a
 * clear and retention, so this is decided the same way for a new, cleared or full conversation.
 *
 * @param lastSequence - The conversation's stored last sequence.
 * @param expectedSequence - The sequence the caller saw.
 * @returns `true` only when they match.
 */
export function isSequenceCurrent(lastSequence: number, expectedSequence: number): boolean {
  return lastSequence === expectedSequence;
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
