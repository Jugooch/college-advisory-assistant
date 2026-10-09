/**
 * @file Server action: loads the student's transcript for a term again, after a conflict.
 * @module @caa/web/features/conversation/actions/reload-conversation
 * @requirement FR-10
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
'use server';

import { ApiError } from '@caa/api-contract';
import { ErrorCode, TermIdSchema } from '@caa/domain';

import { getConversation } from '@/api/conversation.api';
import { toFailureResult } from '@/shared/utils/action-failure';
import { keepApiError } from '@/shared/utils/keep-api-error';

import type { ReloadResult } from '../utils/conversation-state';

/**
 * Reads the stored transcript for the term. Nothing is changed.
 *
 * @param studentId - Internal student ID from the page URL.
 * @param termId - The term whose transcript to load.
 * @returns The transcript, or the API's error.
 */
export async function reloadConversationAction(
  studentId: string,
  termId: string,
): Promise<ReloadResult> {
  const parsed = TermIdSchema.safeParse(termId);
  if (!parsed.success) {
    return {
      kind: 'failed',
      code: ErrorCode.InvalidRequest,
      message: 'Unknown term.',
      requestId: null,
    };
  }
  const conversation = await keepApiError(getConversation(studentId, { termId: parsed.data }));
  return conversation instanceof ApiError
    ? toFailureResult(conversation)
    : { kind: 'loaded', conversation };
}
