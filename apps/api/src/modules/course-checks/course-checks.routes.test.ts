/**
 * @file HTTP-level tests for `POST /v1/students/:studentId/course-checks`: each role, 401,
 * NOT_FOUND that doesn't reveal existence, strict bodies, unknown courses, missing and stale
 * audits, replay, the out-of-scope backstop, and request-scoped logs with opaque IDs only.
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-05
 * @requirement FR-10
 * @requirement NFR-01
 * @requirement NFR-04
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CourseChecksResponseSchema } from '@caa/api-contract';
import { CheckState, ErrorCode, ReasonCode } from '@caa/domain';
import { buildCourse, buildStudent, SYNTHETIC_TENANTS } from '@caa/test-kit';

import { buildRecordAudit, buildRecordSnapshot } from '../../testing/academic-fixtures';
import { bearer, buildWorldApp, readError, STUDENTS, TOKENS } from '../../testing/fixtures';
import {
  buildSeedAcademicStore,
  SEED_COURSES,
  SEED_SNAPSHOTS,
} from '../../testing/seed-scenario-fixtures';

const lines: string[] = [];
const { app, store } = buildWorldApp({ write: (line) => lines.push(line) });
const { math102, ind390 } = SEED_COURSES;
const foreignAudit = buildRecordAudit({ tenantId: SYNTHETIC_TENANTS.b.id }, 9);
const leakyLines: string[] = [];
// NOTE: every app is built once at module scope so Fastify's startup cost never counts against a
// test's timeout (#83). This one's audit repository ignores its tenant filter.
const { app: leakyApp, store: leakyStore } = buildWorldApp(
  { write: (line) => leakyLines.push(line) },
  {
    auditSnapshots: { findLatest: () => Promise.resolve({ status: 'FOUND', audit: foreignAudit }) },
  },
);
Object.assign(leakyStore, buildSeedAcademicStore());

beforeEach(() => {
  lines.length = 0;
  Object.assign(store, buildSeedAcademicStore());
});

/**
 * Posts a course-checks request with a dev token.
 *
 * @param studentId - Path param, sent as-is.
 * @param token - Dev token, or null for no session.
 * @param body - Request body.
 * @returns The injected response.
 */
async function postChecks(studentId: string, token: string | null, body: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: `/v1/students/${studentId}/course-checks`,
    headers: token === null ? {} : bearer(token),
    payload: body,
  });
}

/**
 * Parses a success body with the response contract.
 *
 * @param body - The parsed JSON body.
 * @returns The checks.
 */
function readChecks(body: unknown) {
  return z.object({ data: CourseChecksResponseSchema }).parse(body).data;
}

const MATH_102 = { courseIds: [math102.id] };

describe('POST /v1/students/:studentId/course-checks', () => {
  it('returns the checks to the student themself, pinned to the inputs', async () => {
    const response = await postChecks(STUDENTS.own.id, TOKENS.student, MATH_102);
    const checks = readChecks(response.json());

    expect(response.statusCode).toBe(200);
    expect(checks.pinnedInputs).toEqual({
      studentSnapshotId: SEED_SNAPSHOTS.current.id,
      studentRecordEffectiveAt: '2026-09-01T05:00:00.000Z',
      auditRecordEffectiveAt: '2026-09-01T05:00:00.000Z',
      auditSource: 'demo-audit',
      auditVersion: 'audit_demo_r1',
      rulesetVersion: 'demo-2026.1',
    });
    expect(checks.courseResults[0]?.prerequisite?.state).toBe(CheckState.Pass);
  });

  it.each([
    ['an assigned advisor', TOKENS.advisor],
    ['an admin of the same tenant', TOKENS.tenantAdmin],
  ])('returns the checks to %s', async (_role, token) => {
    expect((await postChecks(STUDENTS.own.id, token, MATH_102)).statusCode).toBe(200);
  });

  it('returns the same 404 for a forbidden student as for a missing one', async () => {
    const forbidden = await postChecks(STUDENTS.other.id, TOKENS.student, MATH_102);
    const missing = await postChecks(buildStudent({}, 99).id, TOKENS.student, MATH_102);

    expect([forbidden.statusCode, missing.statusCode]).toEqual([404, 404]);
    expect(readError(missing.json())).toEqual(readError(forbidden.json()));
  });

  it.each([
    ['an advisor for an unassigned student', STUDENTS.other.id, TOKENS.advisor],
    ['an admin of another tenant', STUDENTS.own.id, TOKENS.admin],
    ['an ID that is not a UUID', 'not-a-uuid', TOKENS.tenantAdmin],
  ])('returns 404 to %s', async (_case, studentId, token) => {
    const response = await postChecks(studentId, token, MATH_102);

    expect(response.statusCode).toBe(404);
    expect(readError(response.json()).code).toBe(ErrorCode.NotFound);
  });

  it('returns 401 without a session', async () => {
    expect((await postChecks(STUDENTS.own.id, null, MATH_102)).statusCode).toBe(401);
  });

  it('gives deep-equal bodies when the same request is replayed', async () => {
    const body = { courseIds: [math102.id, ind390.id] };

    const first = await postChecks(STUDENTS.own.id, TOKENS.student, body);
    const second = await postChecks(STUDENTS.own.id, TOKENS.student, body);

    expect(second.json()).toEqual(first.json());
  });
});

describe('POST /v1/students/:studentId/course-checks request errors', () => {
  it.each([
    ['a tenant field', { ...MATH_102, tenantId: SYNTHETIC_TENANTS.b.id }],
    ['a role field', { ...MATH_102, roles: ['ADMIN'] }],
    ['no courses', { courseIds: [] }],
    ['a repeated course', { courseIds: [math102.id, math102.id] }],
    [
      'a selection for a course not in the set',
      { ...MATH_102, creditSelections: [{ courseId: ind390.id, selectedCreditsHundredths: 200 }] },
    ],
  ])('returns 400 INVALID_REQUEST for a body with %s', async (_case, body) => {
    const response = await postChecks(STUDENTS.own.id, TOKENS.student, body);

    expect(response.statusCode).toBe(400);
    expect(readError(response.json())).toEqual({
      code: ErrorCode.InvalidRequest,
      message: 'The request was invalid',
    });
  });

  it('returns 400 for a course outside the tenant catalog', async () => {
    const response = await postChecks(STUDENTS.own.id, TOKENS.student, {
      courseIds: [buildCourse({}, 0x999).id],
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for a selected credit value the course can never award', async () => {
    const response = await postChecks(STUDENTS.own.id, TOKENS.student, {
      courseIds: [ind390.id],
      creditSelections: [{ courseId: ind390.id, selectedCreditsHundredths: 900 }],
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('POST /v1/students/:studentId/course-checks record states', () => {
  it('returns 503 SOURCE_UNAVAILABLE with a referral when there is no audit', async () => {
    store.audits = [];

    const response = await postChecks(STUDENTS.own.id, TOKENS.student, MATH_102);

    expect(response.statusCode).toBe(503);
    expect(readError(response.json())).toEqual({
      code: ErrorCode.SourceUnavailable,
      message: 'Your academic record is not available yet. Please contact your advisor.',
    });
  });

  it('reports applicability and allocation UNKNOWN AUDIT_STALE for a stale audit', async () => {
    store.studentSnapshots = [
      ...(store.studentSnapshots ?? []),
      buildRecordSnapshot(
        {
          studentId: STUDENTS.own.id,
          attemptIds: SEED_SNAPSHOTS.current.attemptIds,
          sourceEffectiveAt: '2026-09-01T10:00:00.000Z',
          ingestedAt: '2026-09-01T11:00:00.000Z',
        },
        7,
      ),
    ];

    const checks = readChecks((await postChecks(STUDENTS.own.id, TOKENS.advisor, MATH_102)).json());
    const stale = { state: CheckState.Unknown, reasonCode: ReasonCode.AuditStale };

    expect(checks.courseResults[0]?.applicability).toMatchObject(stale);
    expect(checks.setResults.allocation).toEqual([expect.objectContaining(stale)]);
  });

  it('shows an in-progress prerequisite as CONDITIONAL in the 200 body, never eligible', async () => {
    const response = await postChecks(STUDENTS.own.id, TOKENS.student, {
      courseIds: [SEED_COURSES.phys301.id],
    });

    expect(response.statusCode).toBe(200);
    expect(readChecks(response.json()).courseResults[0]?.prerequisite).toMatchObject({
      state: 'CONDITIONAL',
      reasonCode: 'IN_PROGRESS_MIN_GRADE',
    });
  });

  it.each([
    ['just past 24 hours old', '2026-08-31T11:59:59.999Z', 409],
    ['exactly 24 hours old', '2026-08-31T12:00:00.000Z', 200],
  ])('answers a record and audit %s with %i', async (_case, recordAt, status) => {
    store.studentSnapshots = [
      buildRecordSnapshot({
        studentId: STUDENTS.own.id,
        sourceEffectiveAt: recordAt,
        ingestedAt: recordAt,
      }),
    ];
    store.audits = [
      buildRecordAudit({
        studentId: STUDENTS.own.id,
        studentRecordEffectiveAt: recordAt,
        generatedAt: recordAt,
      }),
    ];

    const response = await postChecks(STUDENTS.own.id, TOKENS.student, MATH_102);

    expect(response.statusCode).toBe(status);
  });

  it('returns 409 STALE_SOURCE with a referral when the record is too old', async () => {
    const old = '2026-08-01T00:00:00.000Z';
    store.studentSnapshots = [
      buildRecordSnapshot({ studentId: STUDENTS.own.id, sourceEffectiveAt: old, ingestedAt: old }),
    ];
    store.audits = [
      buildRecordAudit({
        studentId: STUDENTS.own.id,
        studentRecordEffectiveAt: old,
        generatedAt: old,
      }),
    ];

    const response = await postChecks(STUDENTS.own.id, TOKENS.student, MATH_102);

    expect(response.statusCode).toBe(409);
    expect(readError(response.json())).toEqual({
      code: ErrorCode.StaleSource,
      message: 'Your academic record needs to be verified. Please contact your advisor.',
    });
  });

  it('refers seeded SYN-000002 with 409 STALE_SOURCE before the engine runs (scenario 4)', async () => {
    const response = await postChecks(STUDENTS.other.id, TOKENS.tenantAdmin, MATH_102);

    expect(response.statusCode).toBe(409);
    expect(readError(response.json())).toEqual({
      code: ErrorCode.StaleSource,
      message: 'Your academic record needs to be verified. Please contact your advisor.',
    });
  });

  it('reports an unselected variable credit as UNKNOWN', async () => {
    const response = await postChecks(STUDENTS.own.id, TOKENS.student, { courseIds: [ind390.id] });

    expect(readChecks(response.json()).setResults.creditLoad).toMatchObject({
      state: CheckState.Unknown,
      reasonCode: ReasonCode.VariableCreditUnselected,
    });
  });
});

/** The fields of a pino JSON line these tests read; other fields pass through. */
const LogLineSchema = z.looseObject({
  msg: z.string(),
  level: z.number(),
  reqId: z.string().optional(),
});

describe('course checks logs and backstop', () => {
  it('carry the request ID on the run line and hold no personal data', async () => {
    const response = await postChecks(STUDENTS.own.id, TOKENS.student, MATH_102);
    const parsed = lines.map((line) => LogLineSchema.parse(JSON.parse(line)));
    const completed = parsed.find((line) => line.msg === 'request completed');

    expect(response.statusCode).toBe(200);
    expect(parsed.filter((line) => line.msg === 'course checks run')).toEqual([
      expect.objectContaining({ reqId: completed?.reqId, studentId: STUDENTS.own.id }),
    ]);
    expect(lines.join('')).not.toContain(STUDENTS.own.sourceStudentId);
    expect(lines.join('')).not.toContain(TOKENS.student);
  });

  it('returns 404 with no audit data for an out-of-scope audit, and logs a warn event', async () => {
    const response = await leakyApp.inject({
      method: 'POST',
      url: `/v1/students/${STUDENTS.own.id}/course-checks`,
      headers: bearer(TOKENS.student),
      payload: MATH_102,
    });
    const events = leakyLines
      .map((line) => LogLineSchema.parse(JSON.parse(line)))
      .filter((line) => line.msg === 'academic record out of scope');

    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain(foreignAudit.auditVersion);
    expect(events).toEqual([expect.objectContaining({ level: 40, recordId: foreignAudit.id })]);
  });
});
