/**
 * @file Acceptance: AC10 through the API. When the record changed after the audit (beyond the
 * one-hour skew) or names another program or catalog, both endpoints report the audit-derived
 * checks as UNKNOWN, never PASS, and the aggregate is never VALIDATED. Passing dimensions that
 * don't read the audit are kept. Expected values restate golden cases GC-STALE-001, GC-STALE-002,
 * GC-STALE-003, GC-PROG-001, GC-PROG-002 and GC-PROG-005 literally.
 * @requirement FR-04
 * @requirement FR-05
 * @requirement NFR-04
 * @requirement T03
 * @requirement AC10
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/planning/07-system-architecture-and-design.md
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  AggregateState,
  CheckState,
  ReasonCode,
  RequirementState,
  type StudentSnapshotInput,
} from '@caa/domain';
import { completedAttempt, SYNTHETIC_COURSES } from '@caa/test-kit';

import {
  buildAcademicApp,
  checkCourses,
  createAcademicWorld,
  readSummary,
  recordSnapshot,
  resetAcademicWorld,
} from '../support/academic-endpoints-harness';

const { math102 } = SYNTHETIC_COURSES;
const MATH101_B = completedAttempt();
const MATH102_ONLY = { courseIds: [math102.id] };
const PROGRAM_1 = '80000000-0000-4000-8000-000000000001';
const PROGRAM_2 = '80000000-0000-4000-8000-000000000002';
const STALE = { state: CheckState.Unknown, reasonCode: ReasonCode.AuditStale };
const MISMATCH = { state: CheckState.Unknown, reasonCode: ReasonCode.AuditProgramMismatch };

const world = createAcademicWorld();

// NOTE: built once at module scope, like AC15 and AC21, so Fastify's first build doesn't count
// against a case's timeout.
const app = buildAcademicApp(world);

/**
 * Stores the record the audit ran against (snapshot seed 1 at 06:00Z) and, when given, a later
 * revision. Both list the DEMO-MATH 101 attempt with a B.
 *
 * @param overrides - Fields of the latest revision.
 * @param seed - 1 changes the revision the audit ran against; any other adds a new revision.
 */
function storeRecord(overrides: Partial<StudentSnapshotInput>, seed: number): void {
  const attemptIds = [MATH101_B.id];
  const latest = recordSnapshot({ attemptIds, ...overrides }, seed);
  world.studentSnapshots = seed === 1 ? [latest] : [recordSnapshot({ attemptIds }, 1), latest];
}

/** A revision at 09:00Z, three hours after the record the audit ran against (GC-STALE-001). */
const REVISED_LATER = {
  sourceEffectiveAt: '2026-09-01T09:00:00.000Z',
  ingestedAt: '2026-09-01T09:05:00.000Z',
};

describe('AC10 via the API: an audit that does not match the record is never validated', () => {
  beforeEach(() => {
    resetAcademicWorld(world, { attempts: [MATH101_B] });
  });

  it('shows the audit as stale in the summary when the record was revised later', async () => {
    storeRecord(REVISED_LATER, 2);

    const response = await readSummary(app);

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          studentSnapshot: {
            id: 'a0000000-0000-4000-8000-000000000002',
            sourceEffectiveAt: '2026-09-01T09:00:00.000Z',
          },
          auditReflectsRecord: STALE,
        },
      },
    });
  });

  it('makes applicability and allocation UNKNOWN AUDIT_STALE, keeping the prerequisite PASS', async () => {
    storeRecord(REVISED_LATER, 2);

    const response = await checkCourses(app, MATH102_ONLY);

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          courseResults: [{ prerequisite: { state: CheckState.Pass }, applicability: STALE }],
          setResults: { allocation: [STALE] },
          aggregate: AggregateState.NeedsVerification,
        },
      },
    });
  });

  it('treats the same record one millisecond beyond the one-hour skew as stale', async () => {
    storeRecord(
      { sourceEffectiveAt: '2026-09-01T07:00:00.001Z', ingestedAt: '2026-09-01T07:05:00.000Z' },
      1,
    );

    const response = await checkCourses(app, MATH102_ONLY);

    expect(response).toMatchObject({
      statusCode: 200,
      body: { data: { setResults: { allocation: [STALE] } } },
    });
  });

  it('passes the same record exactly one hour after the audit’s record time', async () => {
    storeRecord(
      { sourceEffectiveAt: '2026-09-01T07:00:00.000Z', ingestedAt: '2026-09-01T07:05:00.000Z' },
      1,
    );

    const response = await checkCourses(app, MATH102_ONLY);

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          courseResults: [{ applicability: { state: CheckState.Pass } }],
          aggregate: AggregateState.Validated,
        },
      },
    });
  });

  it('shows a program mismatch in the summary with both programs', async () => {
    storeRecord({ programId: PROGRAM_2 }, 1);

    const response = await readSummary(app);

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          studentSnapshot: { programId: PROGRAM_2 },
          audit: { programId: PROGRAM_1 },
          programCatalogConsistency: MISMATCH,
        },
      },
    });
  });

  it('makes applicability and allocation UNKNOWN on a program mismatch', async () => {
    storeRecord({ programId: PROGRAM_2 }, 1);

    const response = await checkCourses(app, MATH102_ONLY);

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          courseResults: [{ applicability: MISMATCH }],
          setResults: { allocation: [MISMATCH] },
          aggregate: AggregateState.NeedsVerification,
        },
      },
    });
  });

  it('does not deny progress from another program’s complete requirement', async () => {
    resetAcademicWorld(world, {
      attempts: [MATH101_B],
      requirements: [
        {
          state: RequirementState.Complete,
          remainingCreditsHundredths: 0,
          remainingCourseCount: 0,
        },
      ],
    });
    storeRecord({ programId: PROGRAM_2 }, 1);

    const response = await checkCourses(app, MATH102_ONLY);

    expect(response).toMatchObject({
      statusCode: 200,
      body: { data: { courseResults: [{ applicability: MISMATCH }] } },
    });
  });

  it('shows a catalog mismatch in the summary and never validates the set', async () => {
    storeRecord({ catalogYear: '2024-2025' }, 1);

    const summary = await readSummary(app);
    const checks = await checkCourses(app, MATH102_ONLY);

    expect(summary).toMatchObject({
      statusCode: 200,
      body: { data: { programCatalogConsistency: MISMATCH } },
    });
    expect(checks).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          setResults: { allocation: [MISMATCH] },
          aggregate: AggregateState.NeedsVerification,
        },
      },
    });
  });
});
