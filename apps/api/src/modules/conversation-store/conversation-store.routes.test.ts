/**
 * @file HTTP-level tests for `GET` and `DELETE /v1/students/:studentId/conversation`: the
 * transcript, clear, the student-only matrix, 400 for a bad query, 401, and logs without text.
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-14
 * @requirement AC45
 * @requirement AC46
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ConversationResponseSchema } from '@caa/api-contract';
import type { StoredConversationTurn } from '@caa/db';
import {
  ConversationTurnIdSchema,
  ErrorCode,
  ModelStatus,
  NoticeCode,
  TurnRole,
} from '@caa/domain';
import { buildConversation, SYNTHETIC_SCHEDULE_TERM, syntheticId } from '@caa/test-kit';

import { bearer, buildWorldApp, readError, STUDENTS, TOKENS } from '../../testing/fixtures';

const TEXT = 'My synthetic question about late registration.';
const lines: string[] = [];
const { app, store } = buildWorldApp({
  write: (line) => {
    lines.push(line);
  },
});
const termId = SYNTHETIC_SCHEDULE_TERM.termId;
const conversation = buildConversation({ studentId: STUDENTS.own.id });

function stored(sequence: number, role: TurnRole): StoredConversationTurn {
  return {
    id: ConversationTurnIdSchema.parse(syntheticId('conversationTurn', sequence)),
    conversationId: conversation.id,
    sequence,
    role,
    text: TEXT,
    blockRefs: role === TurnRole.Assistant ? [] : null,
    modelStatus: role === TurnRole.Assistant ? ModelStatus.Answered : null,
    metadata: null,
    createdAt: '2026-09-22T15:00:00.000Z',
  };
}

beforeEach(() => {
  lines.length = 0;
  store.conversations = [conversation];
  store.conversationTurns = [stored(1, TurnRole.Student), stored(2, TurnRole.Assistant)];
  store.studentTurnLog = [
    {
      tenantId: conversation.tenantId,
      studentId: conversation.studentId,
      createdAt: '2026-09-22T15:00:00.000Z',
    },
  ];
});

function call(
  method: 'GET' | 'DELETE',
  token: string | null,
  target: { studentId?: string; search?: string } = {},
) {
  const { studentId = STUDENTS.own.id, search = `termId=${termId}` } = target;
  return app.inject({
    method,
    url: `/v1/students/${studentId}/conversation?${search}`,
    ...(token === null ? {} : { headers: bearer(token) }),
  });
}

describe('GET /v1/students/:studentId/conversation', () => {
  it('returns the student their transcript, with chat reported off by default', async () => {
    const response = await call('GET', TOKENS.student);

    expect(response.statusCode).toBe(200);
    const body = ConversationResponseSchema.parse(
      z.object({ data: z.unknown() }).parse(response.json()).data,
    );
    expect(body.available).toBe(false);
    expect(body.unavailableReason).toBe(NoticeCode.Disabled);
    expect(body.turns.map((item) => item.role)).toEqual([TurnRole.Student, TurnRole.Assistant]);
  });

  it.each([
    ['an assigned advisor', TOKENS.advisor, STUDENTS.own.id],
    ['an admin of the same tenant', TOKENS.tenantAdmin, STUDENTS.own.id],
    ['an admin of another tenant', TOKENS.admin, STUDENTS.own.id],
    ['another student’s ID', TOKENS.student, STUDENTS.other.id],
  ])('answers %s with NOT_FOUND', async (_case, token, studentId) => {
    const response = await call('GET', token, { studentId });

    expect(response.statusCode).toBe(404);
    expect(readError(response.json()).code).toBe(ErrorCode.NotFound);
    expect(response.body).not.toContain(TEXT);
  });

  it('answers a malformed student ID with NOT_FOUND', async () => {
    expect((await call('GET', TOKENS.student, { studentId: 'not-an-id' })).statusCode).toBe(404);
  });

  it.each([[''], ['termId=not-a-term'], [`termId=${termId}&tenantId=x`]])(
    'answers query "%s" with INVALID_REQUEST',
    async (search) => {
      const response = await call('GET', TOKENS.student, { search });

      expect(response.statusCode).toBe(400);
      expect(readError(response.json()).code).toBe(ErrorCode.InvalidRequest);
    },
  );

  it('answers a missing token with UNAUTHORIZED', async () => {
    expect((await call('GET', null)).statusCode).toBe(401);
  });

  it('writes no turn text to the log', async () => {
    await call('GET', TOKENS.student);

    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join('\n')).not.toContain(TEXT);
  });
});

describe('DELETE /v1/students/:studentId/conversation', () => {
  it('clears the transcript, so the next read is empty, and keeps the rate-limit log', async () => {
    const cleared = await call('DELETE', TOKENS.student);
    const read = await call('GET', TOKENS.student);

    expect(cleared.statusCode).toBe(204);
    expect(cleared.body).toBe('');
    expect(
      ConversationResponseSchema.parse(z.object({ data: z.unknown() }).parse(read.json()).data)
        .turns,
    ).toEqual([]);
    expect(store.studentTurnLog).toHaveLength(1);
  });

  it.each([
    ['an assigned advisor', TOKENS.advisor, STUDENTS.own.id],
    ['an admin of the same tenant', TOKENS.tenantAdmin, STUDENTS.own.id],
    ['an admin of another tenant', TOKENS.admin, STUDENTS.own.id],
    ['another student’s ID', TOKENS.student, STUDENTS.other.id],
  ])('answers %s with NOT_FOUND and clears nothing', async (_case, token, studentId) => {
    const response = await call('DELETE', token, { studentId });

    expect(response.statusCode).toBe(404);
    expect(store.conversationTurns).toHaveLength(2);
  });

  it('answers a bad query with INVALID_REQUEST and a missing token with UNAUTHORIZED', async () => {
    expect((await call('DELETE', TOKENS.student, { search: '' })).statusCode).toBe(400);
    expect((await call('DELETE', null)).statusCode).toBe(401);
  });
});
