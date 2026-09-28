/**
 * @file Tests for the course-checks contract: request body and response payloads.
 */
import { describe, expect, it } from 'vitest';

import {
  checkCoursesEndpoint,
  CourseChecksRequestSchema,
  CourseChecksResponseSchema,
} from './course-checks.contract';

const CALC = '00000000-0000-4000-8000-000000000101';
const PHYSICS = '00000000-0000-4000-8000-000000000102';
const RESEARCH = '00000000-0000-4000-8000-000000000103';

/**
 * Builds a distinct synthetic course ID.
 *
 * @param seed - Number that makes the ID unique.
 * @returns A UUID string.
 */
const courseId = (seed: number): string =>
  `00000000-0000-4000-8000-${String(seed).padStart(12, '0')}`;

describe('checkCoursesEndpoint', () => {
  it('declares POST /v1/students/:studentId/course-checks', () => {
    expect(checkCoursesEndpoint).toMatchObject({
      method: 'POST',
      path: '/v1/students/:studentId/course-checks',
    });
  });
});

describe('CourseChecksRequestSchema', () => {
  const accepts = (body: unknown): boolean => CourseChecksRequestSchema.safeParse(body).success;

  it('accepts one course with no credit selections', () => {
    expect(CourseChecksRequestSchema.parse({ courseIds: [CALC] })).toEqual({ courseIds: [CALC] });
  });

  it('accepts a credit selection for a listed course', () => {
    const body = {
      courseIds: [CALC, RESEARCH],
      creditSelections: [{ courseId: RESEARCH, selectedCreditsHundredths: 200 }],
    };

    expect(CourseChecksRequestSchema.parse(body)).toEqual(body);
  });

  it('accepts 1 to 12 courses and rejects 0 or 13', () => {
    const ids = Array.from({ length: 13 }, (_, index) => courseId(index + 1));

    expect(accepts({ courseIds: ids.slice(0, 12) })).toBe(true);
    expect(accepts({ courseIds: [] })).toBe(false);
    expect(accepts({ courseIds: ids })).toBe(false);
  });

  it('rejects a repeated course', () => {
    expect(accepts({ courseIds: [CALC, PHYSICS, CALC] })).toBe(false);
  });

  it('rejects a course ID that is not a UUID', () => {
    expect(accepts({ courseIds: ['MATH-101'] })).toBe(false);
  });

  it('rejects two credit selections for one course', () => {
    const selection = { courseId: RESEARCH, selectedCreditsHundredths: 200 };

    expect(accepts({ courseIds: [RESEARCH], creditSelections: [selection, selection] })).toBe(
      false,
    );
  });

  it('rejects a credit selection for a course not in courseIds', () => {
    const creditSelections = [{ courseId: RESEARCH, selectedCreditsHundredths: 200 }];

    expect(accepts({ courseIds: [CALC], creditSelections })).toBe(false);
  });

  it('rejects fractional or negative credit values', () => {
    const withCredits = (selectedCreditsHundredths: number): unknown => ({
      courseIds: [RESEARCH],
      creditSelections: [{ courseId: RESEARCH, selectedCreditsHundredths }],
    });

    expect(accepts(withCredits(2.5))).toBe(false);
    expect(accepts(withCredits(-100))).toBe(false);
  });

  it.each([
    ['tenantId', '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f'],
    ['userId', '1a2b3c4d-0000-4000-8000-000000000001'],
    ['role', 'ADVISOR'],
    ['roles', ['ADVISOR']],
  ])('rejects a body that carries %s', (field, value) => {
    expect(accepts({ courseIds: [CALC], [field]: value })).toBe(false);
  });

  it('rejects an unknown field inside a credit selection', () => {
    const creditSelections = [
      { courseId: RESEARCH, selectedCreditsHundredths: 200, tenantId: CALC },
    ];

    expect(accepts({ courseIds: [RESEARCH], creditSelections })).toBe(false);
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
