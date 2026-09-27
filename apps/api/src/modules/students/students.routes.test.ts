/**
 * @file HTTP-level tests for `GET /v1/students/:studentId`: allowed reads, 401, and NOT_FOUND that
 * doesn't reveal whether a student exists.
 * @requirement FR-02
 */
import { describe, expect, it } from 'vitest';

import { ErrorCode } from '@caa/domain';
import { buildStudent } from '@caa/test-kit';

import { bearer, buildWorldApp, readError, STUDENTS, TOKENS } from '../../testing/fixtures';

const { app } = buildWorldApp();

/**
 * Requests one student with a dev token.
 *
 * @param studentId - Path param, sent as-is.
 * @param token - Dev token.
 * @returns The injected response.
 */
async function getStudent(studentId: string, token: string) {
  return app.inject({ method: 'GET', url: `/v1/students/${studentId}`, headers: bearer(token) });
}

describe('GET /v1/students/:studentId', () => {
  it('returns a student their own record with only the contract fields', async () => {
    const response = await getStudent(STUDENTS.own.id, TOKENS.student);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: { id: STUDENTS.own.id, sourceStudentId: STUDENTS.own.sourceStudentId },
    });
  });

  it('returns an assigned student to their advisor', async () => {
    const response = await getStudent(STUDENTS.own.id, TOKENS.advisor);

    expect(response.statusCode).toBe(200);
  });

  it('returns 404 on the second call after the assignment is revoked (AC15)', async () => {
    const world = buildWorldApp();
    const url = `/v1/students/${STUDENTS.own.id}`;
    const headers = bearer(TOKENS.advisor);

    const before = await world.app.inject({ method: 'GET', url, headers });
    world.store.assignments = [];
    const after = await world.app.inject({ method: 'GET', url, headers });

    expect([before.statusCode, after.statusCode]).toEqual([200, 404]);
  });

  it('returns the same 404 for a forbidden student as for a missing one', async () => {
    const forbidden = await getStudent(STUDENTS.other.id, TOKENS.student);
    const missing = await getStudent(buildStudent({}, 99).id, TOKENS.student);

    expect([forbidden.statusCode, missing.statusCode]).toEqual([404, 404]);
    expect(readError(forbidden.json())).toEqual({
      code: ErrorCode.NotFound,
      message: 'The requested resource was not found',
    });
    expect(readError(missing.json())).toEqual(readError(forbidden.json()));
  });

  it('returns 404 to an admin of another tenant', async () => {
    const response = await getStudent(STUDENTS.own.id, TOKENS.admin);

    expect(response.statusCode).toBe(404);
    expect(readError(response.json()).code).toBe(ErrorCode.NotFound);
  });

  it('returns 404, not 400, for an ID that is not a UUID', async () => {
    const response = await getStudent('not-a-uuid', TOKENS.admin);

    expect(response.statusCode).toBe(404);
    expect(readError(response.json()).code).toBe(ErrorCode.NotFound);
  });

  it('returns 401 without a session', async () => {
    const response = await app.inject({ method: 'GET', url: `/v1/students/${STUDENTS.own.id}` });

    expect(response.statusCode).toBe(401);
    expect(readError(response.json()).code).toBe(ErrorCode.Unauthorized);
  });
});
