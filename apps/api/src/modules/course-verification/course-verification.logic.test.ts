/**
 * @file Tests for the course set verification: the README seeded scenarios 1 to 4 on inputs that
 * mirror the seed, "no rule" as null, the engine aggregate, and deterministic replay. Expected
 * values come from the README and the rules, never from running the engine.
 * @requirement FR-05
 * @requirement FR-06
 * @requirement FR-09
 * @requirement FR-10
 * @requirement NFR-01
 */
import { describe, expect, it } from 'vitest';

import {
  AggregateState,
  type AuditSnapshot,
  CheckState,
  type Course,
  type CourseId,
  createAuditSnapshot,
  ReasonCode,
  RequirementState,
  type StudentSnapshot,
} from '@caa/domain';

import {
  SEED_ATTEMPTS,
  SEED_AUDITS,
  SEED_COURSES,
  SEED_POLICY,
  SEED_RULES,
  SEED_SNAPSHOTS,
  SEED_TERMS,
} from '../../testing/seed-scenario-fixtures';
import { type CourseSetInputs, verifyCourseSet } from './course-verification.logic';

/** One hour, the API's default skew. */
const MAX_SKEW_MS = 3_600_000;
const { math102, phys201, phys301, phys301Lab, engl101, ind390 } = SEED_COURSES;
/** Fields every requirement of the test audit shares. */
const ROOT = {
  parentSourceRequirementId: null,
  state: RequirementState.Incomplete,
  allocatedAttemptIds: [],
  remainingCreditsHundredths: null,
  remainingCourseCount: null,
  candidateCourseIds: [],
  isReusable: false,
} as const;

/** The pinned snapshot and audit of one seeded student. */
interface Pinned {
  readonly snapshot: StudentSnapshot;
  readonly audit: AuditSnapshot;
}

/** SYN-000001: the only snapshot and the audit run against it. */
const CURRENT: Pinned = { snapshot: SEED_SNAPSHOTS.current, audit: SEED_AUDITS.current };
/** SYN-000002: the newer snapshot is latest; the audit ran against the older one. */
const STALE: Pinned = { snapshot: SEED_SNAPSHOTS.staleNewer, audit: SEED_AUDITS.stale };

/**
 * SYN-000001's audit, changed so each candidate course has its own outstanding requirement
 * with room for one course: applicability and allocation then pass for PHYS 301, MATH 102,
 * ENGL 101, and IND 390, and only the PHYS 301 prerequisite stays CONDITIONAL.
 */
const ONE_REQUIREMENT_PER_COURSE = createAuditSnapshot({
  ...SEED_AUDITS.current,
  requirements: [
    { ...ROOT, sourceRequirementId: 'REQ-ROOT', label: 'Root', sourceRef: 'test:REQ-ROOT' },
    ...[phys301, math102, engl101, ind390].map((course, index) => ({
      ...ROOT,
      sourceRequirementId: `REQ-${String(index)}`,
      parentSourceRequirementId: 'REQ-ROOT',
      label: course.label,
      remainingCourseCount: 1,
      candidateCourseIds: [course.id],
      sourceRef: `test:REQ-${String(index)}`,
    })),
  ],
});

/**
 * Builds the inputs the course checks service would load for a seeded student.
 *
 * @param pinned - The student's pinned snapshot and audit.
 * @param courses - The candidate set, in request order.
 * @param creditSelections - Chosen credits for variable-credit courses.
 * @returns The pinned inputs.
 */
function inputsFor(
  pinned: Pinned,
  courses: readonly Course[],
  creditSelections: CourseSetInputs['creditSelections'] = [],
): CourseSetInputs {
  return {
    courses: courses.map((course) => ({
      course,
      rule: SEED_RULES.find((rule) => rule.courseId === course.id) ?? null,
    })),
    creditSelections,
    revision: {
      snapshot: pinned.snapshot,
      attempts: SEED_ATTEMPTS.filter((attempt) => pinned.snapshot.attemptIds.includes(attempt.id)),
    },
    audit: pinned.audit,
    catalog: Object.values(SEED_COURSES),
    academicPolicy: SEED_POLICY,
    termCalendar: SEED_TERMS,
    maxSkewMs: MAX_SKEW_MS,
  };
}

/**
 * Checks one course for a seeded student and returns its results.
 *
 * @param pinned - The student's pinned snapshot and audit.
 * @param course - The course.
 * @returns The course's per-course results.
 */
function checkOne(pinned: Pinned, course: Course) {
  const [result] = verifyCourseSet(inputsFor(pinned, [course])).courseResults;
  return result;
}

describe('verifyCourseSet on the seeded scenarios (README)', () => {
  it('scenario 1: DEMO-MATH 102 prerequisite is PASS, the later B counting over the D', () => {
    expect(checkOne(CURRENT, math102)?.prerequisite).toMatchObject({
      state: CheckState.Pass,
      sourceRef: 'demo-catalog-rule:DEMO-MATH-102',
      evidence: { rulesetVersion: 'demo-2026.1' },
    });
  });

  it('scenario 2: DEMO-PHYS 301 prerequisite is CONDITIONAL on the in-progress PHYS 201', () => {
    const prerequisite = checkOne(CURRENT, phys301)?.prerequisite;

    expect(prerequisite).toMatchObject({
      state: CheckState.Conditional,
      reasonCode: ReasonCode.InProgressMinGrade,
    });
    expect(prerequisite?.evidence?.decisiveLeaves).toContainEqual(
      expect.objectContaining({ courseId: phys201.id, reasonCode: ReasonCode.InProgressMinGrade }),
    );
  });

  const scenario3 = [math102, phys301, engl101, ind390];

  it('scenario 3: with no credits chosen for DEMO-IND 390 the load is UNKNOWN, with no total', () => {
    const { creditLoad } = verifyCourseSet(inputsFor(CURRENT, scenario3)).setResults;

    expect(creditLoad).toMatchObject({
      state: CheckState.Unknown,
      reasonCode: ReasonCode.VariableCreditUnselected,
      evidence: { courseIds: [ind390.id], creditLoad: null },
    });
  });

  it('scenario 3: choosing 2.00 for DEMO-IND 390 is PASS at 12.00, the inclusive minimum', () => {
    const selections = [{ courseId: ind390.id, selectedCreditsHundredths: 200 }];

    const { creditLoad } = verifyCourseSet(inputsFor(CURRENT, scenario3, selections)).setResults;

    expect(creditLoad).toMatchObject({
      state: CheckState.Pass,
      evidence: {
        creditLoad: {
          totalCreditsHundredths: 1200,
          minCreditsHundredths: 1200,
          maxCreditsHundredths: 1800,
        },
      },
    });
  });

  it('scenario 3: adding DEMO-PHYS 301L and choosing 3.00 is PASS at 14.00', () => {
    const selections = [{ courseId: ind390.id, selectedCreditsHundredths: 300 }];

    const { creditLoad } = verifyCourseSet(
      inputsFor(CURRENT, [...scenario3, phys301Lab], selections),
    ).setResults;

    expect(creditLoad.state).toBe(CheckState.Pass);
    expect(creditLoad.evidence?.creditLoad?.totalCreditsHundredths).toBe(1400);
  });

  // NOTE: the endpoint refuses SYN-000002 first, with 409 STALE_SOURCE, because its audit's
  // record time is 17 days old (course-checks.routes.test.ts). This covers the engine path the
  // README describes, reached only if the audit were fresh but ran against an older snapshot.
  it('scenario 4, engine path: SYN-000002 applicability and allocation are UNKNOWN AUDIT_STALE', () => {
    const checks = verifyCourseSet(inputsFor(STALE, [math102]));
    const stale = { state: CheckState.Unknown, reasonCode: ReasonCode.AuditStale };

    expect(checks.courseResults[0]?.applicability).toMatchObject(stale);
    expect(checks.setResults.allocation).toEqual([expect.objectContaining(stale)]);
    // NOTE: 3.00 credits is below the 12.00 minimum, so credit load FAILs, and FAIL outranks
    // the UNKNOWN checks: BLOCKED, never VALIDATED.
    expect(checks.aggregate).toBe(AggregateState.Blocked);
  });
});

describe('verifyCourseSet', () => {
  it('reports a course with no prerequisite rule as null, not a PASS', () => {
    expect(checkOne(CURRENT, engl101)?.prerequisite).toBeNull();
  });

  it('pins the snapshot, audit, and ruleset versions, and the record times they describe', () => {
    expect(verifyCourseSet(inputsFor(CURRENT, [math102])).pinnedInputs).toEqual({
      studentSnapshotId: SEED_SNAPSHOTS.current.id,
      studentRecordEffectiveAt: '2026-09-01T05:00:00.000Z',
      auditRecordEffectiveAt: '2026-09-01T05:00:00.000Z',
      auditSource: 'demo-audit',
      auditVersion: 'audit_demo_r1',
      rulesetVersion: 'demo-2026.1',
    });
  });

  it('returns results in request order, one per course', () => {
    const order: readonly CourseId[] = [ind390.id, math102.id, engl101.id];

    const checks = verifyCourseSet(inputsFor(CURRENT, [ind390, math102, engl101]));

    expect(checks.courseResults.map((result) => result.courseId)).toEqual(order);
  });

  it('aggregates to NEEDS_VERIFICATION when a check is UNKNOWN and none FAIL', () => {
    expect(verifyCourseSet(inputsFor(CURRENT, [ind390])).aggregate).toBe(
      AggregateState.NeedsVerification,
    );
  });

  it('aggregates to CONDITIONAL, never VALIDATED, when the only non-PASS check is CONDITIONAL', () => {
    const selections = [{ courseId: ind390.id, selectedCreditsHundredths: 300 }];
    const pinned = { snapshot: SEED_SNAPSHOTS.current, audit: ONE_REQUIREMENT_PER_COURSE };

    const checks = verifyCourseSet(
      inputsFor(pinned, [phys301, math102, engl101, ind390], selections),
    );
    const nonPassing = [
      ...checks.courseResults.flatMap((result) => [result.prerequisite, result.applicability]),
      ...checks.setResults.allocation,
      checks.setResults.creditLoad,
    ].filter((result) => result !== null && result.state !== CheckState.Pass);

    expect(nonPassing).toEqual([
      expect.objectContaining({ kind: 'PREREQUISITE', state: 'CONDITIONAL' }),
    ]);
    expect(checks.aggregate).toBe('CONDITIONAL');
  });

  it('gives deep-equal results when the same inputs are replayed', () => {
    const first = verifyCourseSet(inputsFor(CURRENT, [math102, phys301, ind390]));
    const second = verifyCourseSet(inputsFor(CURRENT, [math102, phys301, ind390]));

    expect(second).toEqual(first);
  });
});
