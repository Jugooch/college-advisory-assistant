/**
 * @file HTTP-level tests for `GET /v1/students/:studentId`: allowed reads, 401, and NOT_FOUND that
 * doesn't reveal whether a student exists, and access-decision logs that carry the request ID.
 * @requirement FR-02
 * @requirement FR-14
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ErrorCode } from '@caa/domain';
import { buildStudent } from '@caa/test-kit';

import { bearer, buildWorldApp, readError, STUDENTS, TOKENS } from '../../testing/fixtures';

const rawLines: string[] = [];
// NOTE: built once at module scope, so Fastify's startup cost never counts against a test's
// timeout (#83). Tests that change the store or read logs are reset before each test.
const { app, store } = buildWorldApp({ write: (line) => rawLines.push(line) });
const ASSIGNMENTS = store.assignments;

beforeEach(() => {
  rawLines.length = 0;
  store.assignments = ASSIGNMENTS;
});

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
    const url = `/v1/students/${STUDENTS.own.id}`;
    const headers = bearer(TOKENS.advisor);

    const before = await app.inject({ method: 'GET', url, headers });
    store.assignments = [];
    const after = await app.inject({ method: 'GET', url, headers });

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

/** The fields of a pino JSON line these tests read; other fields pass through. */
const LogLineSchema = z.looseObject({ msg: z.string(), reqId: z.string().optional() });

/**
 * Requests one student with a dev token and reads the log lines that request wrote.
 *
 * @param studentId - Path param, sent as-is.
 * @param token - Dev token.
 * @returns The response, the access-decision lines, the `reqId` of the request-completed line,
 *   and every raw log line.
 */
async function getStudentCapturingLogs(studentId: string, token: string) {
  rawLines.length = 0;
  const response = await app.inject({
    method: 'GET',
    url: `/v1/students/${studentId}`,
    headers: bearer(token),
  });
  const lines = rawLines.map((line) => LogLineSchema.parse(JSON.parse(line)));
  const decisions = lines.filter((line) => line.msg === 'student access decision');
  const completed = lines.find((line) => line.msg === 'request completed');
  return { response, decisions, completedReqId: completed?.reqId, rawLines: [...rawLines] };
}

describe('access-decision logs (FR-14)', () => {
  it('carry the request ID on an allowed read', async () => {
    const { response, decisions, completedReqId } = await getStudentCapturingLogs(
      STUDENTS.own.id,
      TOKENS.advisor,
    );

    expect(response.statusCode).toBe(200);
    expect(completedReqId).toEqual(expect.any(String));
    expect(decisions).toEqual([
      expect.objectContaining({
        reqId: completedReqId,
        isAllowed: true,
        reason: 'ACTIVE_ASSIGNMENT',
      }),
    ]);
  });

  it('carry the request ID returned in the error envelope on a denied read', async () => {
    const { response, decisions } = await getStudentCapturingLogs(
      STUDENTS.other.id,
      TOKENS.student,
    );
    const { requestId } = z
      .object({ error: z.object({ requestId: z.string() }) })
      .parse(response.json()).error;

    expect(response.statusCode).toBe(404);
    expect(decisions).toEqual([
      expect.objectContaining({ reqId: requestId, isAllowed: false, reason: 'NO_GRANT' }),
    ]);
  });

  it('never contain source student IDs or tokens', async () => {
    const { rawLines } = await getStudentCapturingLogs(STUDENTS.own.id, TOKENS.student);

    expect(rawLines.join('')).not.toContain(STUDENTS.own.sourceStudentId);
    expect(rawLines.join('')).not.toContain(TOKENS.student);
  });
});
