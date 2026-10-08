/**
 * @file Tests of the turn request handling: the strict body, the student-only matrix, and a race.
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-10
 * @requirement FR-14
 * @requirement NFR-05
 * @requirement AC43
 * @requirement AC44
 * @requirement AC45
 * @requirement AC46
 * @requirement AC47
 */
import { describe, expect, it } from 'vitest';

import { finalStep, IntroId } from '@caa/assistant';
import { ErrorCode } from '@caa/domain';

import { setupTurnApp } from '../../testing/conversation-turn-harness';
import { readError, STUDENTS, TOKENS } from '../../testing/fixtures';

describe('POST /v1/students/:studentId/conversation/turns', () => {
  it.each([
    ['prior assistant turns', { turns: [{ role: 'ASSISTANT', text: 'x' }] }],
    ['a history key', { history: [] }],
    ['a tenant', { tenantId: 'tenant-x' }],
    ['a user', { userId: 'user-x' }],
    ['a role', { role: 'ADMIN' }],
  ])('refuses a body with %s', async (_name, extra) => {
    const { postRaw, store } = setupTurnApp({ steps: [] });

    const response = await postRaw('hello', { extra });

    expect(response.statusCode).toBe(400);
    expect(readError(response.json()).code).toBe(ErrorCode.InvalidRequest);
    expect(store.conversationTurns).toEqual([]);
  });

  it.each([
    ['another student’s ID', TOKENS.student, STUDENTS.other.id],
    ['an assigned advisor', TOKENS.advisor, STUDENTS.own.id],
    ['an admin', TOKENS.tenantAdmin, STUDENTS.own.id],
    ['a malformed ID', TOKENS.student, 'not-an-id'],
  ])('answers %s with NOT_FOUND', async (_name, token, studentId) => {
    const { postRaw, model } = setupTurnApp({ steps: [] });

    const response = await postRaw('hello', { token, studentId });

    expect(response.statusCode).toBe(404);
    expect(readError(response.json()).code).toBe(ErrorCode.NotFound);
    expect(model?.requests).toEqual([]);
  });

  it('answers a race with REVISION_CONFLICT', async () => {
    const { postRaw } = setupTurnApp({ steps: [finalStep(IntroId.AskForDetail)] });

    const response = await postRaw('hello', { expectedSequence: 7 });

    expect(response.statusCode).toBe(409);
    expect(readError(response.json()).code).toBe(ErrorCode.RevisionConflict);
  });
});
