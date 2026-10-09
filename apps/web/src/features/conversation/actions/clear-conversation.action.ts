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

import { toFailureResult } from '../utils/action-failure';
import type { ClearResult } from '../utils/conversation-state';

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
  try {
    await clearConversation(studentId, { termId: parsed.data });
    return { kind: 'cleared' };
  } catch (error) {
    if (error instanceof ApiError) {
      return toFailureResult(error);
    }
    throw error;
  }
}
