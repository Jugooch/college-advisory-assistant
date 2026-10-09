/**
 * @file What the conversation actions return to the chat panel. Every field is serializable.
 * @module @caa/web/features/conversation/utils/conversation-state
 * @requirement FR-10
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { AssistantTurnView, ConversationResponse } from '@caa/api-contract';

import type { FailureResult } from './action-failure';
import { REJECTED_MESSAGE } from './conversation-wording';

/** The outcome of posting one turn. */
export type SendTurnResult =
  | {
      readonly kind: 'replied';
      readonly turn: AssistantTurnView;
      readonly lastSequence?: number;
    }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'rejected' }
  | FailureResult;

/** The outcome of clearing the transcript. */
export type ClearResult = { readonly kind: 'cleared' } | FailureResult;

/** The outcome of reloading the transcript after a conflict. */
export type ReloadResult =
  { readonly kind: 'loaded'; readonly conversation: ConversationResponse } | FailureResult;

/** A failure to show beside the input. */
export interface ChatProblem {
  readonly message: string;
  readonly requestId: string | null;
}

/**
 * Reads the failure out of a result that isn't a reply or a conflict.
 *
 * @param result - A `rejected` or `failed` result.
 * @returns The message and support reference to show.
 */
export function problemFrom(
  result: Extract<SendTurnResult, { kind: 'rejected' | 'failed' }>,
): ChatProblem {
  return result.kind === 'rejected'
    ? { message: REJECTED_MESSAGE, requestId: null }
    : { message: result.message, requestId: result.requestId };
}
