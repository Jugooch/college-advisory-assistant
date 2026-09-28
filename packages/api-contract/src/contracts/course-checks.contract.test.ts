/**
 * @file Tests for the course-checks contract: endpoint and response payloads.
 */
import { describe, expect, it } from 'vitest';

import { checkCoursesEndpoint, CourseChecksResponseSchema } from './course-checks.contract';

const CALC = '00000000-0000-4000-8000-000000000101';
const PHYSICS = '00000000-0000-4000-8000-000000000102';

describe('checkCoursesEndpoint', () => {
  it('declares POST /v1/students/:studentId/course-checks', () => {
    expect(checkCoursesEndpoint).toMatchObject({
      method: 'POST',
      path: '/v1/students/:studentId/course-checks',
    });
  });
});

describe('CourseChecksResponseSchema', () => {
  const PREREQUISITE_PASS = {
    kind: 'PREREQUISITE',
    state: 'PASS',
    sourceRef: 'demo-rules:MATH-201',
    evidence: { rulesetVersion: 'demo-2026.1', decisiveLeaves: [] },
  };
  const APPLICABILITY_PASS = { kind: 'REQUIREMENT_APPLICABILITY', state: 'PASS' };
  const LOAD_EVIDENCE = {
    rulesetVersion: null,
    decisiveLeaves: [],
    creditLoad: {
      totalCreditsHundredths: 1400,
      minCreditsHundredths: 1200,
      maxCreditsHundredths: 1800,
    },
  };
  const VALID = {
    courseResults: [
      { courseId: CALC, prerequisite: PREREQUISITE_PASS, applicability: APPLICABILITY_PASS },
      { courseId: PHYSICS, prerequisite: null, applicability: APPLICABILITY_PASS },
    ],
    setResults: {
      allocation: [{ kind: 'REQUIREMENT_ALLOCATION', state: 'PASS' }],
      creditLoad: { kind: 'CREDIT_LOAD', state: 'PASS', evidence: LOAD_EVIDENCE },
    },
    aggregate: 'VALIDATED',
    pinnedInputs: {
      studentSnapshotId: '3c4d5e6f-0000-4000-8000-000000000001',
      auditSource: 'demo-audit',
      auditVersion: 'audit_demo_r7',
      rulesetVersion: 'demo-2026.1',
    },
  };
  const accepts = (payload: unknown): boolean =>
    CourseChecksResponseSchema.safeParse(payload).success;
  const withCourse = (index: number, patch: object): unknown => ({
    ...VALID,
    courseResults: VALID.courseResults.map((result, position) =>
      position === index ? { ...result, ...patch } : result,
    ),
  });

  it('accepts a validated set and keeps a null prerequisite as null', () => {
    const parsed = CourseChecksResponseSchema.parse(VALID);

    expect(parsed.courseResults[1]?.prerequisite).toBeNull();
    expect(parsed.pinnedInputs.auditVersion).toBe('audit_demo_r7');
  });

  it('rejects a check of the wrong kind in each slot', () => {
    expect(accepts(withCourse(0, { prerequisite: APPLICABILITY_PASS }))).toBe(false);
    expect(accepts(withCourse(0, { applicability: PREREQUISITE_PASS }))).toBe(false);
    expect(
      accepts({ ...VALID, setResults: { ...VALID.setResults, allocation: [APPLICABILITY_PASS] } }),
    ).toBe(false);
    expect(
      accepts({ ...VALID, setResults: { ...VALID.setResults, creditLoad: APPLICABILITY_PASS } }),
    ).toBe(false);
  });

  it('rejects a missing applicability check or an empty allocation list', () => {
    expect(accepts(withCourse(1, { applicability: null }))).toBe(false);
    expect(accepts({ ...VALID, setResults: { ...VALID.setResults, allocation: [] } })).toBe(false);
  });

  it('applies the domain check rules end to end', () => {
    const unexplained = { kind: 'REQUIREMENT_APPLICABILITY', state: 'UNKNOWN' };
    const passWithoutArithmetic = { kind: 'CREDIT_LOAD', state: 'PASS' };

    expect(accepts(withCourse(1, { applicability: unexplained }))).toBe(false);
    expect(
      accepts({ ...VALID, setResults: { ...VALID.setResults, creditLoad: passWithoutArithmetic } }),
    ).toBe(false);
  });

  it('rejects VALIDATED when any check is not PASS, and accepts the matching aggregate', () => {
    const unknownLoad = {
      kind: 'CREDIT_LOAD',
      state: 'UNKNOWN',
      reasonCode: 'VARIABLE_CREDIT_UNSELECTED',
      evidence: {
        rulesetVersion: null,
        decisiveLeaves: [],
        courseIds: [PHYSICS],
        creditLoad: null,
      },
    };
    const setResults = { ...VALID.setResults, creditLoad: unknownLoad };

    expect(accepts({ ...VALID, setResults })).toBe(false);
    expect(accepts({ ...VALID, setResults, aggregate: 'NEEDS_VERIFICATION' })).toBe(true);
  });

  it('rejects a prerequisite PASS without evidence, so it is tied to the pinned ruleset', () => {
    const withoutEvidence = {
      kind: 'PREREQUISITE',
      state: 'PASS',
      sourceRef: 'demo-rules:MATH-201',
    };

    expect(accepts(withCourse(0, { prerequisite: withoutEvidence }))).toBe(false);
  });

  it('accepts a prerequisite UNKNOWN without evidence, since it claims no verdict', () => {
    const unknown = { kind: 'PREREQUISITE', state: 'UNKNOWN', reasonCode: 'UNSUPPORTED_RULE' };

    expect(
      accepts({
        ...(withCourse(0, { prerequisite: unknown }) as object),
        aggregate: 'NEEDS_VERIFICATION',
      }),
    ).toBe(true);
  });

  it('rejects a repeated course', () => {
    const [first] = VALID.courseResults;

    expect(accepts({ ...VALID, courseResults: [first, first] })).toBe(false);
  });

  it('rejects a prerequisite evaluated under a ruleset other than the pinned one', () => {
    const otherRuleset = {
      ...PREREQUISITE_PASS,
      evidence: { rulesetVersion: 'demo-2025.2', decisiveLeaves: [] },
    };

    expect(accepts(withCourse(0, { prerequisite: otherRuleset }))).toBe(false);
  });

  it('rejects pinned inputs without an audit version or with an empty ruleset version', () => {
    const withoutAuditVersion = Object.fromEntries(
      Object.entries(VALID.pinnedInputs).filter(([field]) => field !== 'auditVersion'),
    );

    expect(accepts({ ...VALID, pinnedInputs: withoutAuditVersion })).toBe(false);
    expect(accepts({ ...VALID, pinnedInputs: { ...VALID.pinnedInputs, rulesetVersion: '' } })).toBe(
      false,
    );
  });

  it('rejects an aggregate outside the registry', () => {
    expect(accepts({ ...VALID, aggregate: 'PROBABLY_FINE' })).toBe(false);
  });
});
