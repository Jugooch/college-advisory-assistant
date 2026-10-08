/**
 * @file Tests for the send-turn action: what is sent, and how each result and error returns.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';
import { buildAssistantTurnView, buildConversationResponse, syntheticId } from '@caa/test-kit';

import { getConversation, postConversationTurn } from '@/api/conversation.api';

import { sendTurnAction } from './send-turn.action';

vi.mock('@/api/conversation.api', () => ({
  getConversation: vi.fn(),
  postConversationTurn: vi.fn(),
}));

const STUDENT_ID = syntheticId('student', 1);
const TERM_ID = syntheticId('term', 1);
const REQUEST = { termId: TERM_ID, message: 'Hi', expectedSequence: 2 };

/**
 * Builds an API error envelope.
 *
 * @param code - The error code.
 * @param status - The HTTP status.
 * @returns The error.
 */
function apiError(code: ApiError['code'], status: number): ApiError {
  return new ApiError({ code, status, message: 'API says', requestId: 'req-3' });
}

describe('sendTurnAction', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('sends the checked request and returns the reply', async () => {
    const turn = buildAssistantTurnView();
    vi.mocked(postConversationTurn).mockResolvedValue({ turn });

    const result = await sendTurnAction(STUDENT_ID, REQUEST);

    expect(postConversationTurn).toHaveBeenCalledWith(STUDENT_ID, REQUEST);
    expect(result).toEqual({ kind: 'replied', turn });
  });

  it('sends nothing when the request does not parse', async () => {
    const result = await sendTurnAction(STUDENT_ID, { ...REQUEST, message: '   ' });

    expect(result).toEqual({ kind: 'rejected' });
    expect(postConversationTurn).not.toHaveBeenCalled();
  });

  it('reloads the transcript on a revision conflict', async () => {
    const conversation = buildConversationResponse();
    vi.mocked(postConversationTurn).mockRejectedValue(apiError(ErrorCode.RevisionConflict, 409));
    vi.mocked(getConversation).mockResolvedValue(conversation);

    const result = await sendTurnAction(STUDENT_ID, REQUEST);

    expect(getConversation).toHaveBeenCalledWith(STUDENT_ID, { termId: TERM_ID });
    expect(result).toEqual({ kind: 'conflict', conversation });
  });

  it('returns any other API error as a failure', async () => {
    vi.mocked(postConversationTurn).mockRejectedValue(apiError(ErrorCode.InternalError, 500));

    const result = await sendTurnAction(STUDENT_ID, REQUEST);

    expect(result).toMatchObject({
      kind: 'failed',
      code: ErrorCode.InternalError,
      requestId: 'req-3',
    });
    expect(getConversation).not.toHaveBeenCalled();
  });
});
