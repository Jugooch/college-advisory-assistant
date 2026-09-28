/**
 * @file Tests for requirement applicability: each audit state, staleness, and several requirements.
 */
import { describe, expect, it } from 'vitest';

import type { CourseId, RequirementResult } from '@caa/domain';
import { buildAuditSnapshot, buildRequirementResult, SYNTHETIC_COURSES } from '@caa/test-kit';

import { AuditRecordInputError } from './check-audit-reflects-record';
import { evaluateApplicability } from './evaluate-applicability';

/** DEMO-MATH 101, equivalent to DEMO-MATH 111. */
const CALC_ID = SYNTHETIC_COURSES.math101.id;
const CALC_ALIAS_ID = SYNTHETIC_COURSES.math111.id;
/** The record the default audit ran against, so the audit is fresh. */
const FRESH = { studentRecordEffectiveAt: '2026-09-20T07:30:00.000-05:00', maxSkewMs: 0 };
/** A record one second newer than the default audit's, beyond a zero skew. */
const STALE = { studentRecordEffectiveAt: '2026-09-20T07:30:01.000-05:00', maxSkewMs: 0 };

/**
 * Builds a requirement that lists DEMO-MATH 101 as its only candidate.
 *
 * @param state - The requirement's audit state.
 * @param seed - Drives `REQ-00<seed>`.
 * @returns The requirement.
 */
function calcRequirement(state: RequirementResult['state'], seed = 1): RequirementResult {
  const remaining = state === 'COMPLETE' ? 0 : 1;
  return buildRequirementResult(
    {
      state,
      candidateCourseIds: [CALC_ID],
      remainingCourseCount: remaining,
      remainingCreditsHundredths: remaining * 300,
    },
    seed,
  );
}

/**
 * Evaluates a course against an audit of the given requirements.
 *
 * @param requirements - The audit's requirements.
 * @param courseId - The course; DEMO-MATH 101 by default.
 * @param freshness - The record and skew; fresh by default.
 * @returns The applicability check.
 */
function checkOf(
  requirements: readonly RequirementResult[],
  courseId: CourseId = CALC_ID,
  freshness = FRESH,
): unknown {
  return evaluateApplicability(courseId, buildAuditSnapshot({ requirements }), freshness);
}

/**
 * Builds the expected check.
 *
 * @param state - The expected state.
 * @param sourceRef - The expected source reference.
 * @param reasonCode - The expected reason code, omitted for PASS.
 * @returns The expected check result.
 */
function expected(state: string, sourceRef: string, reasonCode?: string): unknown {
  return {
    kind: 'REQUIREMENT_APPLICABILITY',
    state,
    sourceRef,
    ...(reasonCode === undefined ? {} : { reasonCode }),
    evidence: { rulesetVersion: null, decisiveLeaves: [] },
  };
}

describe('evaluateApplicability for one requirement', () => {
  it('passes a candidate for an INCOMPLETE requirement, naming the requirement', () => {
    expect(checkOf([calcRequirement('INCOMPLETE')])).toEqual(
      expected('PASS', 'demo-audit:audit_demo_r1:demo-audit/REQ-001'),
    );
  });

  it('is CONDITIONAL for a candidate of an IN_PROGRESS requirement, never PASS', () => {
    expect(checkOf([calcRequirement('IN_PROGRESS')])).toEqual(
      expected(
        'CONDITIONAL',
        'demo-audit:audit_demo_r1:demo-audit/REQ-001',
        'REQUIREMENT_IN_PROGRESS',
      ),
    );
  });

  it('fails with REQUIREMENT_ALREADY_SATISFIED for a candidate of a COMPLETE requirement', () => {
    expect(checkOf([calcRequirement('COMPLETE')])).toEqual(
      expected(
        'FAIL',
        'demo-audit:audit_demo_r1:demo-audit/REQ-001',
        'REQUIREMENT_ALREADY_SATISFIED',
      ),
    );
  });

  it('is UNKNOWN with AUDIT_AMBIGUOUS for a candidate of an AMBIGUOUS requirement', () => {
    expect(checkOf([calcRequirement('AMBIGUOUS')])).toEqual(
      expected('UNKNOWN', 'demo-audit:audit_demo_r1:demo-audit/REQ-001', 'AUDIT_AMBIGUOUS'),
    );
  });

  it('fails with NOT_APPLICABLE, naming the audit revision, when no requirement lists it', () => {
    expect(checkOf([calcRequirement('INCOMPLETE')], SYNTHETIC_COURSES.phys201.id)).toEqual(
      expected('FAIL', 'demo-audit:audit_demo_r1', 'NOT_APPLICABLE'),
    );
  });

  it('fails with NOT_APPLICABLE for an equivalent the audit does not list', () => {
    expect(checkOf([calcRequirement('INCOMPLETE')], CALC_ALIAS_ID)).toEqual(
      expected('FAIL', 'demo-audit:audit_demo_r1', 'NOT_APPLICABLE'),
    );
  });

  it('pins the audit source and version in the source reference', () => {
    const audit = buildAuditSnapshot({ requirements: [calcRequirement('INCOMPLETE')] }, 7);

    expect(evaluateApplicability(CALC_ID, audit, FRESH).sourceRef).toBe(
      'demo-audit:audit_demo_r7:demo-audit/REQ-001',
    );
  });
});

describe('evaluateApplicability with a stale audit', () => {
  it.each(['INCOMPLETE', 'IN_PROGRESS', 'COMPLETE', 'AMBIGUOUS'] as const)(
    'is UNKNOWN with AUDIT_STALE for a candidate of a %s requirement (AC10)',
    (state) => {
      expect(checkOf([calcRequirement(state)], CALC_ID, STALE)).toEqual(
        expected('UNKNOWN', 'demo-audit:audit_demo_r1', 'AUDIT_STALE'),
      );
    },
  );

  it('is UNKNOWN with AUDIT_STALE when no requirement lists the course', () => {
    expect(checkOf([calcRequirement('INCOMPLETE')], CALC_ALIAS_ID, STALE)).toEqual(
      expected('UNKNOWN', 'demo-audit:audit_demo_r1', 'AUDIT_STALE'),
    );
  });

  it('is fresh when the record is newer only within the skew', () => {
    const withinSkew = { ...STALE, maxSkewMs: 1_000 };

    expect(checkOf([calcRequirement('INCOMPLETE')], CALC_ID, withinSkew)).toEqual(
      expected('PASS', 'demo-audit:audit_demo_r1:demo-audit/REQ-001'),
    );
  });

  it('rejects an invalid maximum skew instead of defaulting it', () => {
    const invalid = { ...FRESH, maxSkewMs: -1 };

    expect(() => checkOf([calcRequirement('INCOMPLETE')], CALC_ID, invalid)).toThrow(
      new AuditRecordInputError('maxSkewMs'),
    );
  });
});

describe('evaluateApplicability for a course listed by several requirements', () => {
  it('is UNKNOWN when an AMBIGUOUS requirement lists it, despite an INCOMPLETE one', () => {
    const requirements = [calcRequirement('INCOMPLETE', 1), calcRequirement('AMBIGUOUS', 2)];

    expect(checkOf(requirements)).toEqual(
      expected('UNKNOWN', 'demo-audit:audit_demo_r1:demo-audit/REQ-002', 'AUDIT_AMBIGUOUS'),
    );
  });

  it('passes on an INCOMPLETE requirement, despite an earlier IN_PROGRESS one', () => {
    const requirements = [calcRequirement('IN_PROGRESS', 1), calcRequirement('INCOMPLETE', 2)];

    expect(checkOf(requirements)).toEqual(
      expected('PASS', 'demo-audit:audit_demo_r1:demo-audit/REQ-002'),
    );
  });

  it('is CONDITIONAL on an IN_PROGRESS requirement, despite an earlier COMPLETE one', () => {
    const requirements = [calcRequirement('COMPLETE', 1), calcRequirement('IN_PROGRESS', 2)];

    expect(checkOf(requirements)).toEqual(
      expected(
        'CONDITIONAL',
        'demo-audit:audit_demo_r1:demo-audit/REQ-002',
        'REQUIREMENT_IN_PROGRESS',
      ),
    );
  });

  it('names the first requirement in audit order when several have the same state', () => {
    const requirements = [calcRequirement('INCOMPLETE', 2), calcRequirement('INCOMPLETE', 1)];

    expect(checkOf(requirements)).toEqual(
      expected('PASS', 'demo-audit:audit_demo_r1:demo-audit/REQ-002'),
    );
  });

  it('ignores requirements that do not list the course', () => {
    const other = buildRequirementResult({ state: 'AMBIGUOUS' }, 2);

    expect(checkOf([calcRequirement('COMPLETE', 1), other])).toEqual(
      expected(
        'FAIL',
        'demo-audit:audit_demo_r1:demo-audit/REQ-001',
        'REQUIREMENT_ALREADY_SATISFIED',
      ),
    );
  });

  it('returns a deep-equal check when the same inputs are replayed', () => {
    const requirements = [calcRequirement('IN_PROGRESS', 1), calcRequirement('INCOMPLETE', 2)];

    expect(checkOf(requirements)).toEqual(checkOf([...requirements]));
  });
});
