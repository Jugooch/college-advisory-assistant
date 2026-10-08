/**
 * @file Server action: clears the student's transcript for a term.
 * @module @caa/web/features/conversation/actions/clear-conversation
 * @requirement FR-10
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
'use server';

import { ApiError } from '@caa/api-contract';
import { ErrorCode, TermIdSchema } from '@caa/domain';

import { clearConversation } from '@/api/conversation.api';
import { keepApiError } from '@/shared/utils/keep-api-error';

import { type ClearResult, toFailure } from '../utils/conversation-state';

/**
 * Deletes the stored turns for the term. Nothing else changes: plans and cases are untouched.
 *
 * @param studentId - Internal student ID from the page URL.
 * @param termId - The term whose transcript to clear.
 * @returns `cleared`, or the API's error.
 */
export async function clearConversationAction(
  studentId: string,
  termId: string,
): Promise<ClearResult> {
  const parsed = TermIdSchema.safeParse(termId);
  if (!parsed.success) {
    return {
      kind: 'failed',
      code: ErrorCode.InvalidRequest,
      message: 'Unknown term.',
      requestId: null,
    };
  }
  const result = await keepApiError(
    clearConversation(studentId, { termId: parsed.data }).then(() => null),
  );
  return result instanceof ApiError ? toFailure(result) : { kind: 'cleared' };
}
