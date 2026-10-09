/**
 * @file Tests for the reload action: one read, and how each result returns.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';
import { buildConversationResponse, syntheticId } from '@caa/test-kit';

import { getConversation } from '@/api/conversation.api';

import { reloadConversationAction } from './reload-conversation.action';

vi.mock('@/api/conversation.api', () => ({ getConversation: vi.fn() }));

const STUDENT_ID = syntheticId('student', 1);
const TERM_ID = syntheticId('term', 1);

describe('reloadConversationAction', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns the stored transcript for the term', async () => {
    const conversation = buildConversationResponse();
    vi.mocked(getConversation).mockResolvedValue(conversation);

    const result = await reloadConversationAction(STUDENT_ID, TERM_ID);

    expect(getConversation).toHaveBeenCalledWith(STUDENT_ID, { termId: TERM_ID });
    expect(result).toEqual({ kind: 'loaded', conversation });
  });

  it('returns the API error as a failure', async () => {
    vi.mocked(getConversation).mockRejectedValue(
      new ApiError({
        code: ErrorCode.InternalError,
        status: 500,
        message: 'down',
        requestId: 'req-4',
      }),
    );

    const result = await reloadConversationAction(STUDENT_ID, TERM_ID);

    expect(result).toMatchObject({
      kind: 'failed',
      code: ErrorCode.InternalError,
      requestId: 'req-4',
    });
  });

  it('reads nothing for an unknown term', async () => {
    const result = await reloadConversationAction(STUDENT_ID, 'not a term');

    expect(result).toMatchObject({ kind: 'failed', code: ErrorCode.InvalidRequest });
    expect(getConversation).not.toHaveBeenCalled();
  });
});
