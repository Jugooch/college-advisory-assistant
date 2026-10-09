/**
 * @file Pure rules of the turn response. Nothing here reads a clock, a store, or a service.
 * @module @caa/api/modules/conversation/conversation.logic
 * @requirement FR-01
 * @requirement FR-02
 * @requirement NFR-05
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (sections 2 and 3)
 */
import type { AssistantBlock, AssistantTurnView } from '@caa/api-contract';

import type { TurnDecision } from '../conversation-answer/conversation-answer.logic';

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
