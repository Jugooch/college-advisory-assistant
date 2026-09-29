/**
 * @file Proves the API acceptance harness serves academic data from its own in-memory stores:
 * snapshots and audits, catalog, prerequisite rules, policy, and terms. A missing record reaches
 * the API's documented referral, never the not-configured 500.
 * @requirement FR-03
 * @requirement FR-09
 * @see docs/planning/07-system-architecture-and-design.md
 * @see docs/standards/07-testing.md
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { type AuditSnapshot, Role, type StudentSnapshot } from '@caa/domain';
import {
  buildAcademicPolicy,
  buildAuditSnapshot,
  buildPrerequisiteRule,
  buildStudent,
  buildStudentSnapshot,
  buildTermCalendar,
  buildUserIdentity,
  completedAttempt,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import {
  type AcceptanceWorld,
  buildAcceptanceApp,
  getAs,
  postAs,
  summarizeError,
} from './api-harness';

const ADMIN = buildUserIdentity({ roles: [Role.Admin] }, 31);
const AUTH = 'Bearer harness-admin';
const STUDENT = buildStudent({}, 1);
const SUMMARY_URL = '/v1/students/30000000-0000-4000-8000-000000000001/academic-summary';
const CHECKS_URL = '/v1/students/30000000-0000-4000-8000-000000000001/course-checks';
/** DEMO-MATH 101 with a B in 2026SP. */
const MATH101_B = completedAttempt({}, 1);

/**
 * Builds student 1's snapshot, six hours before the harness clock, listing the MATH 101 attempt.
 *
 * @param seed - Snapshot seed.
 * @returns The snapshot.
 */
function snapshotAtSix(seed: number): StudentSnapshot {
  return buildStudentSnapshot(
    {
      attemptIds: [MATH101_B.id],
      sourceEffectiveAt: '2026-09-01T06:00:00.000Z',
      ingestedAt: '2026-09-01T06:30:00.000Z',
    },
    seed,
  );
}

/** The audit run against snapshot 1 at 07:00Z. */
const AUDIT: AuditSnapshot = buildAuditSnapshot({
  generatedAt: '2026-09-01T07:00:00.000Z',
  studentRecordEffectiveAt: '2026-09-01T06:00:00.000Z',
});

const world: AcceptanceWorld = { identities: [ADMIN], students: [STUDENT], assignments: [] };

// NOTE: built once at module scope, like the acceptance cases, so Fastify's first build doesn't
// count against a case's timeout.
const app = buildAcceptanceApp(world, [{ token: 'harness-admin', identity: ADMIN }]);

describe('buildAcceptanceApp academic stores', () => {
  beforeEach(() => {
    world.attempts = [MATH101_B];
    world.studentSnapshots = [snapshotAtSix(1)];
    world.audits = [AUDIT];
    world.courses = Object.values(SYNTHETIC_COURSES);
    world.rules = [buildPrerequisiteRule()];
    world.policies = [
      buildAcademicPolicy({
        termCreditBounds: { minCreditsHundredths: 300, maxCreditsHundredths: 1800 },
      }),
    ];
    world.terms = buildTermCalendar();
  });

  it('serves the academic summary from the stored snapshot and audit', async () => {
    const response = await getAs(app, SUMMARY_URL, AUTH);

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          studentSnapshot: {
            id: 'a0000000-0000-4000-8000-000000000001',
            sourceEffectiveAt: '2026-09-01T06:00:00.000Z',
          },
          audit: { auditSource: 'demo-audit', auditVersion: 'audit_demo_r1' },
          auditReflectsRecord: { state: 'PASS', reasonCode: null },
          programCatalogConsistency: { state: 'PASS', reasonCode: null },
        },
      },
    });
  });

  it('runs course checks over the stored catalog, rule, policy, and terms', async () => {
    const response = await postAs(app, {
      url: CHECKS_URL,
      authorization: AUTH,
      payload: { courseIds: [SYNTHETIC_COURSES.math102.id] },
    });

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          courseResults: [
            {
              courseId: '50000000-0000-4000-8000-000000000102',
              prerequisite: { state: 'PASS', sourceRef: 'demo-rule-0001' },
              applicability: { state: 'PASS' },
            },
          ],
          setResults: { creditLoad: { state: 'PASS' } },
          aggregate: 'VALIDATED',
          pinnedInputs: {
            studentSnapshotId: 'a0000000-0000-4000-8000-000000000001',
            auditVersion: 'audit_demo_r1',
            rulesetVersion: 'demo-2026.1',
          },
        },
      },
    });
  });

  it('refers the student with 503 SOURCE_UNAVAILABLE, not a 500, when no snapshot is stored', async () => {
    world.studentSnapshots = [];

    const response = await getAs(app, SUMMARY_URL, AUTH);

    expect(summarizeError(response)).toMatchObject({
      statusCode: 503,
      code: 'SOURCE_UNAVAILABLE',
    });
  });

  it('refers the student with 409 STALE_SOURCE when two snapshots tie for latest', async () => {
    world.studentSnapshots = [snapshotAtSix(1), snapshotAtSix(2)];

    const response = await getAs(app, SUMMARY_URL, AUTH);

    expect(summarizeError(response)).toMatchObject({ statusCode: 409, code: 'STALE_SOURCE' });
  });
});
