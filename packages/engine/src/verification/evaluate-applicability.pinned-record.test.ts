/**
 * @file Tests for requirement applicability against the pinned student record: identity, revision, program.
 */
import { describe, expect, it } from 'vitest';

import {
  type RequirementResult,
  type StudentSnapshot,
  type StudentSnapshotInput,
} from '@caa/domain';
import {
  buildAuditSnapshot,
  buildRequirementResult,
  buildStudentSnapshot,
  SYNTHETIC_COURSES,
  syntheticId,
} from '@caa/test-kit';

import { evaluateApplicability } from './evaluate-applicability';

const CALC_ID = SYNTHETIC_COURSES.math101.id;

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
 * Builds a requirement that lists DEMO-MATH 101 as its only candidate.
 *
 * @param state - The requirement's audit state.
 * @returns The requirement.
 */
function calcRequirement(state: RequirementResult['state']): RequirementResult {
  const remaining = state === 'COMPLETE' ? 0 : 1;
  return buildRequirementResult({
    state,
    candidateCourseIds: [CALC_ID],
    remainingCourseCount: remaining,
    remainingCreditsHundredths: remaining * 300,
  });
}

/**
 * Evaluates DEMO-MATH 101 against an audit of one requirement, for the given pinned record.
 *
 * @param state - The requirement's audit state.
 * @param studentSnapshot - The pinned record.
 * @returns The applicability check.
 */
function checkOf(state: RequirementResult['state'], studentSnapshot: StudentSnapshot): unknown {
  const audit = buildAuditSnapshot({ requirements: [calcRequirement(state)] });
  return evaluateApplicability(CALC_ID, audit, { studentSnapshot, maxSkewMs: 0 });
}

/**
 * Builds the expected check naming only the audit revision.
 *
 * @param reasonCode - The expected reason code.
 * @returns The expected UNKNOWN check.
 */
function unknownFor(reasonCode: string): unknown {
  return {
    kind: 'REQUIREMENT_APPLICABILITY',
    state: 'UNKNOWN',
    reasonCode,
    sourceRef: 'demo-audit:audit_demo_r1',
    evidence: { rulesetVersion: null, decisiveLeaves: [] },
  };
}

describe('evaluateApplicability with the pinned record', () => {
  it('passes a candidate for an INCOMPLETE requirement of the record program', () => {
    expect(checkOf('INCOMPLETE', snapshotWith())).toEqual({
      kind: 'REQUIREMENT_APPLICABILITY',
      state: 'PASS',
      sourceRef: 'demo-audit:audit_demo_r1:demo-audit/REQ-001',
      evidence: { rulesetVersion: null, decisiveLeaves: [] },
    });
  });

  it.each(['INCOMPLETE', 'IN_PROGRESS', 'COMPLETE', 'AMBIGUOUS'] as const)(
    'is UNKNOWN AUDIT_PROGRAM_MISMATCH, never PASS or FAIL, for a %s requirement of another program',
    (state) => {
      const record = snapshotWith({ programId: syntheticId('program', 2) });

      expect(checkOf(state, record)).toEqual(unknownFor('AUDIT_PROGRAM_MISMATCH'));
    },
  );

  it('is UNKNOWN AUDIT_PROGRAM_MISMATCH when the record states no catalog', () => {
    expect(checkOf('COMPLETE', snapshotWith({ catalogYear: null }))).toEqual(
      unknownFor('AUDIT_PROGRAM_MISMATCH'),
    );
  });

  it('is UNKNOWN AUDIT_AMBIGUOUS for an audit of another student', () => {
    expect(checkOf('INCOMPLETE', snapshotWith({ studentId: syntheticId('student', 2) }))).toEqual(
      unknownFor('AUDIT_AMBIGUOUS'),
    );
  });

  it('is UNKNOWN AUDIT_STALE for a later revision of the record (AC10)', () => {
    const record = snapshotWith({
      id: syntheticId('studentSnapshot', 2),
      sourceEffectiveAt: '2026-09-20T09:00:00.000-05:00',
    });

    expect(checkOf('INCOMPLETE', record)).toEqual(unknownFor('AUDIT_STALE'));
  });

  it('is UNKNOWN AUDIT_AMBIGUOUS when the record is older than the audit record', () => {
    const record = snapshotWith({ sourceEffectiveAt: '2026-09-20T07:29:59.999-05:00' });

    expect(checkOf('COMPLETE', record)).toEqual(unknownFor('AUDIT_AMBIGUOUS'));
  });
});
