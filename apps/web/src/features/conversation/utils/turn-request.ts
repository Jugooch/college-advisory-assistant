/**
 * @file Builds the body of a turn request: the message and the facts the server needs, never
 * earlier turns.
 * @module @caa/web/features/conversation/utils/turn-request
 * @requirement FR-10
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { ScheduleOptionsRequest } from '@caa/api-contract';

/** The facts a turn request is built from. */
export interface TurnRequestInput {
  /** The term the planner form is for. */
  readonly termId: string;
  /** The trimmed message. */
  readonly message: string;
  /** The latest stored sequence the student has seen. */
  readonly expectedSequence: number;
  /** The form's confirmed inputs, or null. */
  readonly plannerInputs: ScheduleOptionsRequest | null;
}

/**
 * Builds the request.
 *
 * @param input - The term, message, latest sequence and confirmed inputs.
 * @returns The request body; `plannerInputs` is left out when null.
 */
export function buildTurnRequest({
  plannerInputs,
  ...rest
}: TurnRequestInput): Record<string, unknown> {
  return plannerInputs === null ? rest : { ...rest, plannerInputs };
}
