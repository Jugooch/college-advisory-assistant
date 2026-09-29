/**
 * @file Tests for the allocation check against the pinned student record: identity, revision, program.
 */
import { describe, expect, it } from 'vitest';

import { type Course, type StudentSnapshot, type StudentSnapshotInput } from '@caa/domain';
import {
  buildAuditSnapshot,
  buildRequirementResult,
  buildStudentSnapshot,
  SYNTHETIC_COURSES,
  SYNTHETIC_TENANTS,
  syntheticId,
} from '@caa/test-kit';

import type { CourseSelection } from './candidate-set';
import { checkAllocation } from './check-allocation';

const { math101, math102 } = SYNTHETIC_COURSES;
const CANDIDATES = [select(math101), select(math102)];
/** One requirement with room for one course, so the two candidates compete for it. */
const CONTESTED_AUDIT = buildAuditSnapshot({
  requirements: [
    buildRequirementResult({
      candidateCourseIds: [math101.id, math102.id],
      remainingCourseCount: 1,
      remainingCreditsHundredths: null,
    }),
  ],
});

/**
 * Builds a credit-bearing selection with no chosen value.
 *
 * @param course - The course.
 * @returns The selection.
 */
function select(course: Course): CourseSelection {
  return { course, selectedCreditsHundredths: null, countsCredits: true };
}

/**
 * Builds the snapshot the default audit ran against, ingested late enough for any record time
 * the tests use, with the given fields replaced.
 *
 * @param overrides - Fields to replace.
 * @returns The student snapshot.
 */
function snapshotWith(overrides: Partial<StudentSnapshotInput> = {}): StudentSnapshot {
  return buildStudentSnapshot({ ingestedAt: '2026-09-21T00:00:00.000-05:00', ...overrides });
}

/**
 * Builds the one expected check naming every candidate and only the audit revision.
 *
 * @param reasonCode - The expected reason code.
 * @returns The expected checks.
 */
function unknownFor(reasonCode: string): unknown {
  return [
    {
      kind: 'REQUIREMENT_ALLOCATION',
      state: 'UNKNOWN',
      reasonCode,
      sourceRef: 'demo-audit:audit_demo_r1',
      evidence: { rulesetVersion: null, decisiveLeaves: [], courseIds: [math101.id, math102.id] },
    },
  ];
}

describe('checkAllocation with the pinned record', () => {
  it('reports the contest when the audit is for the record program', () => {
    const checks = checkAllocation(CANDIDATES, CONTESTED_AUDIT, {
      studentSnapshot: snapshotWith(),
      maxSkewMs: 0,
    });

    expect(checks.map((check) => [check.state, check.reasonCode])).toEqual([
      ['UNKNOWN', 'ALLOCATION_CONFLICT'],
    ]);
  });

  it('is one UNKNOWN AUDIT_PROGRAM_MISMATCH check, never PASS, for another catalog', () => {
    const audit = buildAuditSnapshot();
    const studentSnapshot = snapshotWith({ catalogYear: '2026-2027' });

    expect(checkAllocation(CANDIDATES, audit, { studentSnapshot, maxSkewMs: 0 })).toEqual(
      unknownFor('AUDIT_PROGRAM_MISMATCH'),
    );
  });

  it('reports a program mismatch instead of the contest the audit would show', () => {
    const studentSnapshot = snapshotWith({ programId: null });

    expect(checkAllocation(CANDIDATES, CONTESTED_AUDIT, { studentSnapshot, maxSkewMs: 0 })).toEqual(
      unknownFor('AUDIT_PROGRAM_MISMATCH'),
    );
  });

  it('is one UNKNOWN AUDIT_AMBIGUOUS check for an audit of another tenant', () => {
    const studentSnapshot = snapshotWith({ tenantId: SYNTHETIC_TENANTS.b.id });

    expect(checkAllocation(CANDIDATES, CONTESTED_AUDIT, { studentSnapshot, maxSkewMs: 0 })).toEqual(
      unknownFor('AUDIT_AMBIGUOUS'),
    );
  });

  it('is one UNKNOWN AUDIT_STALE check for a later revision of the record (AC10)', () => {
    const studentSnapshot = snapshotWith({
      id: syntheticId('studentSnapshot', 2),
      sourceEffectiveAt: '2026-09-20T09:00:00.000-05:00',
    });

    expect(
      checkAllocation(CANDIDATES, CONTESTED_AUDIT, { studentSnapshot, maxSkewMs: 3_600_000 }),
    ).toEqual(unknownFor('AUDIT_STALE'));
  });
});
