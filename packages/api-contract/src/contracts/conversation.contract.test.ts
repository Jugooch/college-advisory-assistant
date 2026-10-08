/**
 * @file Tests for the conversation contract.
 */
import { describe, expect, it } from 'vitest';

import { createApiClient } from '../client/create-api-client';
import { TERM_ID } from '../testing/schedule-option-fixtures';
import {
  AssistantTurnViewSchema,
  clearConversationEndpoint,
  ConversationQuerySchema,
  ConversationResponseSchema,
  ConversationTurnRequestSchema,
  ConversationTurnResponseSchema,
  getConversationEndpoint,
  postConversationTurnEndpoint,
} from './conversation.contract';

const STUDENT_ID = '2b3c4d5e-0000-4000-8000-000000000001';
const AT = '2026-10-08T09:00:00-05:00';
const NOTICE = {
  kind: 'NOTICE',
  code: 'MODEL_UNAVAILABLE',
  templateId: 'notice.model-unavailable',
  templateVersion: '1',
  text: 'The assistant is unavailable. Use the planner form.',
};
const ANSWER = { sequence: 2, intro: 'Here is what I found.', modelStatus: 'ANSWERED', blocks: [] };
const STUDENT_TURN = { sequence: 1, role: 'STUDENT', text: 'Hello', createdAt: AT };
const ASSISTANT_TURN = {
  sequence: 2,
  role: 'ASSISTANT',
  intro: 'Here is what I found.',
  modelStatus: 'ANSWERED',
  blockRefs: [{ kind: 'SCHEDULE_OPTIONS', shownAt: AT }],
  createdAt: AT,
};
const REQUEST = { termId: TERM_ID, message: 'Plan my term', expectedSequence: 0 };
const PLANNER_INPUTS = { termId: TERM_ID, courseIds: [], creditSelections: [], constraints: [] };

/**
 * Builds a fetch stub that records the request and answers with a status and optional body.
 *
 * @param status - HTTP status to return.
 * @param body - JSON body, or `undefined` for none.
 * @returns The stub and the recorded request.
 */
function stub(status: number, body?: unknown): { fetchFn: typeof fetch; seen: Request[] } {
  const seen: Request[] = [];
  const fetchFn = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    seen.push(new Request(input, init));
    return Promise.resolve(
      body === undefined ? new Response(null, { status }) : Response.json(body, { status }),
    );
  };
  return { fetchFn, seen };
}

describe('conversation endpoints', () => {
  it('declares the three endpoints of ADR-0015 section 10', () => {
    expect(getConversationEndpoint).toMatchObject({
      method: 'GET',
      path: '/v1/students/:studentId/conversation',
    });
    expect(postConversationTurnEndpoint).toMatchObject({
      method: 'POST',
      path: '/v1/students/:studentId/conversation/turns',
    });
    expect(clearConversationEndpoint).toMatchObject({
      method: 'DELETE',
      path: '/v1/students/:studentId/conversation',
    });
  });

  it('reads the transcript through the typed client with a term query', async () => {
    const { fetchFn, seen } = stub(200, {
      data: { available: true, unavailableReason: null, turns: [STUDENT_TURN, ASSISTANT_TURN] },
    });
    const client = createApiClient({ baseUrl: 'http://api.test', fetchFn });

    const result = await client.call(getConversationEndpoint, {
      params: { studentId: STUDENT_ID },
      query: { termId: TERM_ID },
    });

    expect(result.turns).toHaveLength(2);
    expect(seen[0]?.url).toBe(
      `http://api.test/v1/students/${STUDENT_ID}/conversation?termId=${TERM_ID}`,
    );
  });

  it('posts a turn through the typed client and parses the answer', async () => {
    const { fetchFn, seen } = stub(200, { data: { turn: ANSWER } });
    const client = createApiClient({ baseUrl: 'http://api.test', fetchFn });

    const result = await client.call(postConversationTurnEndpoint, {
      params: { studentId: STUDENT_ID },
      body: REQUEST,
    });

    expect(result.turn.modelStatus).toBe('ANSWERED');
    expect(seen[0]?.method).toBe('POST');
  });

  it('clears a transcript through the typed client on a 204', async () => {
    const { fetchFn, seen } = stub(204);
    const client = createApiClient({ baseUrl: 'http://api.test', fetchFn });

    await expect(
      client.call(clearConversationEndpoint, {
        params: { studentId: STUDENT_ID },
        query: { termId: TERM_ID },
      }),
    ).resolves.toBeUndefined();
    expect(seen[0]?.method).toBe('DELETE');
  });
});

describe('ConversationQuerySchema', () => {
  it('requires a term and rejects any other key', () => {
    expect(ConversationQuerySchema.safeParse({ termId: TERM_ID }).success).toBe(true);
    expect(ConversationQuerySchema.safeParse({}).success).toBe(false);
    expect(ConversationQuerySchema.safeParse({ termId: TERM_ID, tenantId: 'x' }).success).toBe(
      false,
    );
  });
});

describe('ConversationTurnRequestSchema', () => {
  const accepts = (body: unknown): boolean => ConversationTurnRequestSchema.safeParse(body).success;

  it('accepts a message without planner inputs', () => {
    expect(accepts(REQUEST)).toBe(true);
  });

  it('accepts planner inputs for the same term', () => {
    const inputs = { ...PLANNER_INPUTS, courseIds: ['c0a5e000-0000-4000-8000-000000000301'] };
    expect(accepts({ ...REQUEST, plannerInputs: inputs })).toBe(true);
  });

  it('rejects planner inputs for another term', () => {
    const other = { ...PLANNER_INPUTS, termId: '92a3b4c5-0000-4000-8000-000000000099' };
    expect(accepts({ ...REQUEST, plannerInputs: other })).toBe(false);
  });

  it('rejects invalid planner inputs', () => {
    expect(accepts({ ...REQUEST, plannerInputs: { termId: TERM_ID } })).toBe(false);
  });

  it('bounds the message to 1 to 1,000 characters after trimming', () => {
    expect(accepts({ ...REQUEST, message: '' })).toBe(false);
    expect(accepts({ ...REQUEST, message: '   ' })).toBe(false);
    expect(accepts({ ...REQUEST, message: 'a'.repeat(1000) })).toBe(true);
    expect(accepts({ ...REQUEST, message: 'a'.repeat(1001) })).toBe(false);
  });

  it('requires a non-negative integer expectedSequence', () => {
    const missing = { termId: TERM_ID, message: 'Plan my term' };
    expect(accepts(missing)).toBe(false);
    expect(accepts({ ...REQUEST, expectedSequence: -1 })).toBe(false);
    expect(accepts({ ...REQUEST, expectedSequence: 1.5 })).toBe(false);
    expect(accepts({ ...REQUEST, expectedSequence: 7 })).toBe(true);
  });

  it.each(['tenantId', 'userId', 'studentId', 'role', 'turns', 'assistant', 'history'])(
    'rejects a %s key in the body',
    (key) => {
      expect(accepts({ ...REQUEST, [key]: 'x' })).toBe(false);
    },
  );
});

describe('AssistantTurnViewSchema', () => {
  const accepts = (turn: unknown): boolean => AssistantTurnViewSchema.safeParse(turn).success;

  it('accepts an answered turn with blocks', () => {
    expect(accepts({ ...ANSWER, blocks: [NOTICE] })).toBe(true);
  });

  it('rejects a block kind outside the enum', () => {
    expect(accepts({ ...ANSWER, blocks: [{ ...NOTICE, kind: 'FREE_TEXT' }] })).toBe(false);
  });

  it('rejects an intro over 600 characters', () => {
    expect(accepts({ ...ANSWER, intro: 'a'.repeat(600) })).toBe(true);
    expect(accepts({ ...ANSWER, intro: 'a'.repeat(601) })).toBe(false);
  });

  it('rejects more than 12 blocks', () => {
    expect(accepts({ ...ANSWER, blocks: Array.from({ length: 13 }, () => NOTICE) })).toBe(false);
  });

  it.each(['RATE_LIMITED', 'DISABLED'])(
    'has no sequence for %s, which stores nothing',
    (status) => {
      expect(accepts({ ...ANSWER, modelStatus: status, sequence: null })).toBe(true);
      expect(accepts({ ...ANSWER, modelStatus: status })).toBe(false);
    },
  );

  it('requires a sequence for a stored status', () => {
    expect(accepts({ ...ANSWER, sequence: null })).toBe(false);
  });

  it('rejects a status outside the enum', () => {
    expect(accepts({ ...ANSWER, modelStatus: 'OK' })).toBe(false);
  });

  it('rejects identity or history keys on the turn', () => {
    expect(accepts({ ...ANSWER, tenantId: 'x' })).toBe(false);
  });
});

describe('ConversationTurnResponseSchema', () => {
  it('wraps the turn and rejects other keys', () => {
    expect(ConversationTurnResponseSchema.safeParse({ turn: ANSWER }).success).toBe(true);
    expect(ConversationTurnResponseSchema.safeParse({ turn: ANSWER, turns: [] }).success).toBe(
      false,
    );
  });

  it('accepts lastSequence when present or absent and rejects negative or fractional', () => {
    const parse = (v: unknown) =>
      ConversationTurnResponseSchema.safeParse({ turn: ANSWER, lastSequence: v }).success;
    expect(parse(0)).toBe(true);
    expect(parse(2)).toBe(true);
    expect(parse(-1)).toBe(false);
    expect(parse(1.5)).toBe(false);
  });
});

describe('ConversationResponseSchema', () => {
  const ok = { available: true, unavailableReason: null, turns: [STUDENT_TURN, ASSISTANT_TURN] };
  const accepts = (body: unknown): boolean => ConversationResponseSchema.safeParse(body).success;

  it('accepts a transcript of student and assistant turns', () => {
    expect(accepts(ok)).toBe(true);
    expect(accepts({ ...ok, turns: [] })).toBe(true);
  });

  it('keeps a past schedule or plan block as a reference with no result', () => {
    const withResult = {
      ...ASSISTANT_TURN,
      blockRefs: [{ kind: 'SCHEDULE_OPTIONS', shownAt: AT, result: {} }],
    };
    expect(accepts({ ...ok, turns: [withResult] })).toBe(false);
    const noTime = { ...ASSISTANT_TURN, blockRefs: [{ kind: 'SCHEDULE_OPTIONS' }] };
    expect(accepts({ ...ok, turns: [noTime] })).toBe(false);
  });

  it('rejects a stored status that stores nothing', () => {
    const limited = { ...ASSISTANT_TURN, modelStatus: 'RATE_LIMITED' };
    expect(accepts({ ...ok, turns: [limited] })).toBe(false);
  });

  it('says why chat is unavailable, and only then', () => {
    expect(accepts({ ...ok, available: false, unavailableReason: 'DISABLED' })).toBe(true);
    expect(accepts({ ...ok, available: false })).toBe(false);
    expect(accepts({ ...ok, unavailableReason: 'DISABLED' })).toBe(false);
  });

  it('rejects more than 100 turns', () => {
    const turn = (sequence: number): unknown => ({ ...STUDENT_TURN, sequence });
    const turns = (count: number): unknown[] =>
      Array.from({ length: count }, (_unused, i) => turn(i + 1));
    expect(accepts({ ...ok, turns: turns(100) })).toBe(true);
    expect(accepts({ ...ok, turns: turns(101) })).toBe(false);
  });

  it('rejects turns out of order or repeated', () => {
    expect(accepts({ ...ok, turns: [ASSISTANT_TURN, STUDENT_TURN] })).toBe(false);
    expect(accepts({ ...ok, turns: [STUDENT_TURN, STUDENT_TURN] })).toBe(false);
  });

  it('rejects ids and metadata on a turn view', () => {
    const leaky = { ...ASSISTANT_TURN, id: STUDENT_ID, metadata: {} };
    expect(accepts({ ...ok, turns: [leaky] })).toBe(false);
  });

  it('accepts lastSequence when present or absent and rejects negative or fractional', () => {
    const parse = (v: unknown) => accepts({ ...ok, lastSequence: v });
    expect(accepts(ok)).toBe(true);
    expect(parse(0)).toBe(true);
    expect(parse(2)).toBe(true);
    expect(parse(-1)).toBe(false);
    expect(parse(1.5)).toBe(false);
  });
});
