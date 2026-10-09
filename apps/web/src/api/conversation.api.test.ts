/**
 * @file Tests for the conversation calls: what reaches the typed client for each.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TermIdSchema } from '@caa/domain';
import { buildConversationResponse, syntheticId } from '@caa/test-kit';

import { clearConversation, getConversation, postConversationTurn } from './conversation.api';

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(),
}));

// NOTE: swaps the session-cookie client for a real one with a stubbed `fetch`.
vi.mock('@/lib/api-client', async () => {
  const { createApiClient } = await import('@caa/api-contract');
  return {
    apiClient: createApiClient({
      baseUrl: 'http://api.test',
      getHeaders: () => Promise.resolve({}),
      fetchFn: fetchMock as unknown as typeof fetch,
    }),
  };
});

const STUDENT_ID = syntheticId('student', 1);
const TERM_ID = syntheticId('term', 1);
const TERM = { termId: TermIdSchema.parse(TERM_ID) };

describe('conversation calls', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(
      Response.json({ data: buildConversationResponse({ lastSequence: 2 }) }),
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('reads the transcript for the term', async () => {
    const result = await getConversation(STUDENT_ID, TERM);

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `http://api.test/v1/students/${STUDENT_ID}/conversation?termId=${TERM_ID}`,
    );
    expect(result.available).toBe(true);
  });

  it('posts the turn body as JSON', async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        data: {
          turn: { sequence: 2, intro: 'Hi.', modelStatus: 'ANSWERED', blocks: [] },
          lastSequence: 2,
        },
      }),
    );

    await postConversationTurn(STUDENT_ID, { ...TERM, message: 'Hello', expectedSequence: 0 });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual({
      termId: TERM_ID,
      message: 'Hello',
      expectedSequence: 0,
    });
  });

  it('deletes the transcript for the term', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await clearConversation(STUDENT_ID, TERM);

    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE');
  });
});
