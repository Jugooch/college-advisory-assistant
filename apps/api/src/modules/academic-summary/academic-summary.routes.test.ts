/**
 * @file HTTP-level tests for `GET /v1/students/:studentId/academic-summary`: each role, 401,
 * NOT_FOUND that doesn't reveal existence, stale and missing audits, tied records, the source
 * freshness gate (ADR-0008 Amendment 1), the out-of-scope backstop, and request-scoped logs with opaque IDs only.
 * @requirement FR-02
 * @requirement FR-04
 * @requirement FR-05
 * @requirement NFR-04
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CheckState, ErrorCode, ReasonCode, RequirementState } from '@caa/domain';
import { buildStudent, SYNTHETIC_COURSES, syntheticId } from '@caa/test-kit';

import {
  buildRecordAudit,
  buildRecordSnapshot,
  RECORD_TIMES,
} from '../../testing/academic-fixtures';
import { readLogLines } from '../../testing/course-checks-harness';
import { bearer, buildWorldApp, readError, STUDENTS, TOKENS } from '../../testing/fixtures';

const lines: string[] = [];
const { app, store } = buildWorldApp({ write: (line) => lines.push(line) });
const snapshot = buildRecordSnapshot({ studentId: STUDENTS.own.id });
const audit = buildRecordAudit({ studentId: STUDENTS.own.id });

/** Pino's numeric warn level. */
const WARN_LEVEL = 40;
const foreignAudit = buildRecordAudit(
  { studentId: STUDENTS.other.id, auditVersion: 'audit_foreign' },
  9,
);
const leakyLines: string[] = [];
// NOTE: built once at module scope, like the main app, so Fastify's startup cost never counts
// against a test's timeout (#83). Its audit repository ignores the student filter.
const { app: leakyApp } = buildWorldApp(
  { write: (line) => leakyLines.push(line) },
  {
    auditSnapshots: { findLatest: () => Promise.resolve({ status: 'FOUND', audit: foreignAudit }) },
  },
);

beforeEach(() => {
  lines.length = 0;
  store.studentSnapshots = [snapshot];
  store.audits = [audit];
});

/**
 * Requests one student's academic summary with a dev token.
 *
 * @param studentId - Path param, sent as-is.
 * @param token - Dev token, or null for no session.
 * @returns The injected response.
 */
async function getSummary(studentId: string, token: string | null) {
  return app.inject({
    method: 'GET',
    url: `/v1/students/${studentId}/academic-summary`,
    headers: token === null ? {} : bearer(token),
  });
}

/** The fields of the success envelope these tests read. */
const SummaryBodySchema = z.object({
  data: z.looseObject({
    audit: z.unknown(),
    auditReflectsRecord: z.unknown(),
    programCatalogConsistency: z.unknown(),
    requirements: z.array(z.looseObject({ state: z.string() })),
  }),
});

describe('GET /v1/students/:studentId/academic-summary', () => {
  it('returns a student their own summary with only the contract fields', async () => {
    const response = await getSummary(STUDENTS.own.id, TOKENS.student);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        student: { id: STUDENTS.own.id, sourceStudentId: STUDENTS.own.sourceStudentId },
        studentSnapshot: {
          id: snapshot.id,
          programId: syntheticId('program', 1),
          catalogYear: '2025-2026',
          sourceEffectiveAt: RECORD_TIMES.sourceEffectiveAt,
        },
        audit: {
          auditSource: 'demo-audit',
          auditVersion: 'audit_demo_r1',
          programId: syntheticId('program', 1),
          catalogYear: '2025-2026',
          generatedAt: RECORD_TIMES.auditGeneratedAt,
          studentRecordEffectiveAt: RECORD_TIMES.sourceEffectiveAt,
        },
        auditReflectsRecord: { state: CheckState.Pass, reasonCode: null },
        programCatalogConsistency: { state: CheckState.Pass, reasonCode: null },
        requirements: [
          {
            sourceRequirementId: 'REQ-001',
            parentSourceRequirementId: null,
            label: 'Mathematics core',
            state: RequirementState.Incomplete,
            remainingCreditsHundredths: 300,
            remainingCourseCount: 1,
            candidateCourseIds: [SYNTHETIC_COURSES.math102.id],
            sourceRef: 'demo-audit/REQ-001',
          },
        ],
      },
    });
  });

  it.each([
    ['an assigned advisor', TOKENS.advisor],
    ['an admin of the same tenant', TOKENS.tenantAdmin],
  ])('returns the summary to %s', async (_role, token) => {
    const response = await getSummary(STUDENTS.own.id, token);

    expect(response.statusCode).toBe(200);
  });

  it('returns the same 404 for a forbidden student as for a missing one', async () => {
    const forbidden = await getSummary(STUDENTS.other.id, TOKENS.student);
    const missing = await getSummary(buildStudent({}, 99).id, TOKENS.student);

    expect([forbidden.statusCode, missing.statusCode]).toEqual([404, 404]);
    expect(readError(forbidden.json())).toEqual({
      code: ErrorCode.NotFound,
      message: 'The requested resource was not found',
    });
    expect(readError(missing.json())).toEqual(readError(forbidden.json()));
  });

  it.each([
    ['an advisor for an unassigned student', STUDENTS.other.id, TOKENS.advisor],
    ['an admin of another tenant', STUDENTS.own.id, TOKENS.admin],
    ['an ID that is not a UUID', 'not-a-uuid', TOKENS.tenantAdmin],
  ])('returns 404 to %s', async (_case, studentId, token) => {
    const response = await getSummary(studentId, token);

    expect(response.statusCode).toBe(404);
    expect(readError(response.json()).code).toBe(ErrorCode.NotFound);
  });

  it('returns 401 without a session', async () => {
    const response = await getSummary(STUDENTS.own.id, null);

    expect(response.statusCode).toBe(401);
    expect(readError(response.json()).code).toBe(ErrorCode.Unauthorized);
  });
});

describe('GET /v1/students/:studentId/academic-summary record states', () => {
  it('shows a stale audit as UNKNOWN (AUDIT_STALE) with the audit requirement states', async () => {
    store.studentSnapshots = [
      snapshot,
      buildRecordSnapshot(
        {
          studentId: STUDENTS.own.id,
          sourceEffectiveAt: '2026-09-01T05:00:00.000Z',
          ingestedAt: '2026-09-01T06:00:00.000Z',
        },
        2,
      ),
    ];

    const response = await getSummary(STUDENTS.own.id, TOKENS.advisor);
    const { data } = SummaryBodySchema.parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(data.auditReflectsRecord).toEqual({
      state: CheckState.Unknown,
      reasonCode: ReasonCode.AuditStale,
    });
    expect(data.requirements.map((requirement) => requirement.state)).toEqual([
      RequirementState.Incomplete,
    ]);
  });

  it('shows a program mismatch as UNKNOWN (AUDIT_PROGRAM_MISMATCH)', async () => {
    store.studentSnapshots = [
      buildRecordSnapshot({ studentId: STUDENTS.own.id, programId: syntheticId('program', 2) }),
    ];

    const response = await getSummary(STUDENTS.own.id, TOKENS.student);

    expect(SummaryBodySchema.parse(response.json()).data.programCatalogConsistency).toEqual({
      state: CheckState.Unknown,
      reasonCode: ReasonCode.AuditProgramMismatch,
    });
  });

  it('returns a null audit, null verdicts, and no requirements when there is no audit', async () => {
    store.audits = [];

    const response = await getSummary(STUDENTS.own.id, TOKENS.student);

    expect(response.statusCode).toBe(200);
    expect(SummaryBodySchema.parse(response.json()).data).toMatchObject({
      audit: null,
      auditReflectsRecord: null,
      programCatalogConsistency: null,
      requirements: [],
    });
  });

  it('returns 503 SOURCE_UNAVAILABLE with a referral when there is no snapshot', async () => {
    store.studentSnapshots = [];

    const response = await getSummary(STUDENTS.own.id, TOKENS.student);

    expect(response.statusCode).toBe(503);
    expect(readError(response.json())).toEqual({
      code: ErrorCode.SourceUnavailable,
      message: 'Your academic record is not available yet. Please contact your advisor.',
    });
  });

  const pastMaxAge = '2026-08-31T11:59:59.999Z';
  it.each([
    [
      'two snapshots tie',
      () =>
        (store.studentSnapshots = [
          snapshot,
          buildRecordSnapshot({ studentId: STUDENTS.own.id }, 2),
        ]),
    ],
    [
      'two audits tie',
      () => (store.audits = [audit, buildRecordAudit({ studentId: STUDENTS.own.id }, 2)]),
    ],
    [
      "the audit's record time is 1 ms past 24 hours old",
      () =>
        (store.audits = [
          buildRecordAudit({ studentId: STUDENTS.own.id, studentRecordEffectiveAt: pastMaxAge }),
        ]),
    ],
  ])('returns 409 STALE_SOURCE with a referral when %s', async (_case, arrange) => {
    arrange();

    const response = await getSummary(STUDENTS.own.id, TOKENS.student);

    expect(response.statusCode).toBe(409);
    expect(readError(response.json())).toEqual({
      code: ErrorCode.StaleSource,
      message: 'Your academic record needs to be verified. Please contact your advisor.',
    });
  });
});

describe('academic summary logs', () => {
  it('carry the request ID on the read line and hold no personal data', async () => {
    const response = await getSummary(STUDENTS.own.id, TOKENS.student);
    const parsed = readLogLines(lines);
    const completed = parsed.find((line) => line.msg === 'request completed');

    expect(response.statusCode).toBe(200);
    expect(parsed.filter((line) => line.msg === 'academic summary read')).toEqual([
      expect.objectContaining({
        reqId: completed?.reqId,
        studentId: STUDENTS.own.id,
        studentSnapshotId: snapshot.id,
        auditSnapshotId: audit.id,
      }),
    ]);
    expect(lines.join('')).not.toContain(STUDENTS.own.sourceStudentId);
    expect(lines.join('')).not.toContain('Mathematics core');
    expect(lines.join('')).not.toContain(TOKENS.student);
  });

  it('log the unavailable reason with the request ID returned in the envelope', async () => {
    store.studentSnapshots = [];

    const response = await getSummary(STUDENTS.own.id, TOKENS.student);
    const { requestId } = z
      .object({ error: z.object({ requestId: z.string() }) })
      .parse(response.json()).error;

    expect(
      readLogLines(lines).filter((line) => line.msg === 'academic record unavailable'),
    ).toEqual([expect.objectContaining({ reqId: requestId, reason: 'NO_STUDENT_SNAPSHOT' })]);
  });
});

describe('academic summary out-of-scope backstop', () => {
  it('returns 404 with no audit data and logs a warn-level security event', async () => {
    const response = await leakyApp.inject({
      method: 'GET',
      url: `/v1/students/${STUDENTS.own.id}/academic-summary`,
      headers: bearer(TOKENS.student),
    });
    const events = readLogLines(leakyLines).filter(
      (line) => line.msg === 'academic record out of scope',
    );

    expect(response.statusCode).toBe(404);
    expect(readError(response.json()).code).toBe(ErrorCode.NotFound);
    expect(response.body).not.toContain(foreignAudit.auditVersion);
    expect(events).toEqual([
      expect.objectContaining({ level: WARN_LEVEL, recordId: foreignAudit.id }),
    ]);
    expect(leakyLines.join('')).not.toContain('Mathematics core');
  });
});
