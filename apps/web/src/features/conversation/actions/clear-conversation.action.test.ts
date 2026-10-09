/**
 * @file Tests for the clear-conversation action: the term sent and how errors return.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';
import { syntheticId } from '@caa/test-kit';

import { clearConversation } from '@/api/conversation.api';

import { clearConversationAction } from './clear-conversation.action';

vi.mock('@/api/conversation.api', () => ({ clearConversation: vi.fn() }));

const STUDENT_ID = syntheticId('student', 1);
const TERM_ID = syntheticId('term', 1);

describe('clearConversationAction', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('clears the term', async () => {
    vi.mocked(clearConversation).mockResolvedValue(undefined);

    const result = await clearConversationAction(STUDENT_ID, TERM_ID);

    expect(clearConversation).toHaveBeenCalledWith(STUDENT_ID, { termId: TERM_ID });
    expect(result).toEqual({ kind: 'cleared' });
  });

  it('sends nothing for a term that is not an ID', async () => {
    const result = await clearConversationAction(STUDENT_ID, 'fall');

    expect(result).toMatchObject({ kind: 'failed', code: ErrorCode.InvalidRequest });
    expect(clearConversation).not.toHaveBeenCalled();
  });

  it('returns the API error', async () => {
    vi.mocked(clearConversation).mockRejectedValue(
      new ApiError({ code: ErrorCode.NotFound, status: 404, message: 'no', requestId: 'r' }),
    );

    const result = await clearConversationAction(STUDENT_ID, TERM_ID);

    expect(result).toMatchObject({ kind: 'failed', code: ErrorCode.NotFound });
  });
});
