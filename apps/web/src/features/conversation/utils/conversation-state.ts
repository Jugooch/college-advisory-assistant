/**
 * @file What the conversation actions return to the chat panel. Every field is serializable.
 * @module @caa/web/features/conversation/utils/conversation-state
 * @requirement FR-10
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { ApiError, AssistantTurnView, ConversationResponse } from '@caa/api-contract';

import { REJECTED_MESSAGE } from './conversation-wording';

/** The outcome of posting one turn. */
export type SendTurnResult =
  | { readonly kind: 'replied'; readonly turn: AssistantTurnView }
  | { readonly kind: 'conflict'; readonly conversation: ConversationResponse }
  | { readonly kind: 'rejected' }
  | {
      readonly kind: 'failed';
      readonly code: ApiError['code'];
      readonly message: string;
      readonly requestId: string | null;
    };

/** The outcome of clearing the transcript. */
export type ClearResult =
  | { readonly kind: 'cleared' }
  | {
      readonly kind: 'failed';
      readonly code: ApiError['code'];
      readonly message: string;
      readonly requestId: string | null;
    };

/**
 * Builds the serializable part of a failure from an API error.
 *
 * @param error - The error the API returned.
 * @returns Code, message and support reference.
 */
export function toFailure(error: ApiError): {
  readonly kind: 'failed';
  readonly code: ApiError['code'];
  readonly message: string;
  readonly requestId: string | null;
} {
  return { kind: 'failed', code: error.code, message: error.message, requestId: error.requestId };
}

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
