/**
 * @file Golden cases: requirement applicability from the authoritative audit, requirement
 *   ancestors, and audits that are stale for the student record.
 * @module @caa/test-kit/golden/cases/applicability
 * @requirement FR-04
 * @requirement FR-05
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckKind, CheckState, ReasonCode, RequirementState } from '@caa/domain';

import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { type GoldenCase } from '../golden-case.schema';
import { applicabilityCase } from '../golden-case-factories';
import { expectedCheck, mustNot, NEVER_PASS_WHEN_UNKNOWN } from '../golden-expectations';
import {
  auditRequirementRef,
  auditWith,
  FRESH_RECORD,
  pinnedRecord,
  S3_ADJUDICATED_ON,
} from '../golden-inputs';
import { GoldenRuleFamily } from '../golden-rule-family';

const MATH102 = SYNTHETIC_COURSES.math102.id;
const AUTHORITY = 'planning/08 §Authority and result semantics (the audit owns allocation)';
const ISSUE = 'issue #56 (applicability states)';
const APPLIES = CheckKind.RequirementApplicability;
const COMPLETE = {
  state: RequirementState.Complete,
  remainingCreditsHundredths: 0,
  remainingCourseCount: 0,
};
const NOT_APPLIES = mustNot(
  CheckState.Pass,
  'must not claim the course advances an outstanding requirement',
);
const ONE_HOUR_MS = 3_600_000;
const CONSISTENCY =
  'planning/07 §Consistency model (record newer than the audit → UNKNOWN; partner skew)';

/** Applicability and stale-audit cases. The course placed is DEMO-MATH 102. */
export const APPLICABILITY_CASES: readonly GoldenCase[] = [
  applicabilityCase({
    id: 'GC-APP-001',
    family: GoldenRuleFamily.Applicability,
    title: 'A candidate for an incomplete requirement applies',
    requirementIds: ['FR-05', 'T03'],
    inputs: { courseId: MATH102, audit: auditWith({}), freshness: FRESH_RECORD },
    expected: [
      expectedCheck(APPLIES, {
        state: CheckState.Pass,
        reasonCode: null,
        sourceRef: auditRequirementRef(1),
      }),
    ],
    prohibitedClaims: [mustNot(CheckState.Fail, 'must not deny what the audit lists')],
    rationale:
      'The audit lists DEMO-MATH 102 for an outstanding requirement; the check names that requirement.',
    citations: [
      ISSUE,
      AUTHORITY,
      'planning/08 evidence contract example (source_ref pins the audit item)',
    ],
  }),
  applicabilityCase({
    id: 'GC-APP-002',
    family: GoldenRuleFamily.Applicability,
    title: 'A candidate only for a complete requirement does not apply',
    requirementIds: ['FR-05', 'T03'],
    inputs: { courseId: MATH102, audit: auditWith(COMPLETE), freshness: FRESH_RECORD },
    expected: [
      expectedCheck(APPLIES, {
        state: CheckState.Fail,
        reasonCode: ReasonCode.RequirementAlreadySatisfied,
      }),
    ],
    prohibitedClaims: [NOT_APPLIES],
    rationale: 'Nothing remains in the requirement, so the course adds no progress.',
    citations: [ISSUE, AUTHORITY],
  }),
  applicabilityCase({
    id: 'GC-APP-003',
    family: GoldenRuleFamily.Applicability,
    title: 'A candidate for an ambiguous requirement is unknown',
    requirementIds: ['FR-05', 'T03'],
    inputs: {
      courseId: MATH102,
      audit: auditWith({ state: RequirementState.Ambiguous }),
      freshness: FRESH_RECORD,
    },
    expected: [
      expectedCheck(APPLIES, { state: CheckState.Unknown, reasonCode: ReasonCode.AuditAmbiguous }),
    ],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Fail, 'must not settle what the audit leaves open'),
    ],
    rationale:
      'The audit does not settle the requirement; the engine must not infer applicability.',
    citations: [ISSUE, AUTHORITY],
  }),
  applicabilityCase({
    id: 'GC-APP-004',
    family: GoldenRuleFamily.Applicability,
    title: 'A candidate for an in-progress requirement is conditional',
    requirementIds: ['FR-05', 'T03'],
    inputs: {
      courseId: MATH102,
      audit: auditWith({ state: RequirementState.InProgress }),
      freshness: FRESH_RECORD,
    },
    expected: [
      expectedCheck(APPLIES, {
        state: CheckState.Conditional,
        reasonCode: ReasonCode.RequirementInProgress,
      }),
    ],
    prohibitedClaims: [
      mustNot(CheckState.Pass, 'must not claim progress the in-progress work may already cover'),
    ],
    rationale:
      'If the in-progress work satisfies the requirement, this course adds nothing; it applies only if that work falls short.',
    citations: [
      'issue #82 (REQUIREMENT_IN_PROGRESS)',
      'packages/domain RequirementState (IN_PROGRESS maps to CONDITIONAL, never PASS)',
    ],
  }),
  applicabilityCase({
    id: 'GC-APP-005',
    family: GoldenRuleFamily.Applicability,
    title: 'An equivalent of a listed course is not applicable by inference',
    requirementIds: ['FR-05', 'T03'],
    inputs: {
      courseId: SYNTHETIC_COURSES.math101.id,
      audit: auditWith({ candidateCourseIds: [SYNTHETIC_COURSES.math111.id] }),
      freshness: FRESH_RECORD,
    },
    expected: [
      expectedCheck(APPLIES, { state: CheckState.Fail, reasonCode: ReasonCode.NotApplicable }),
    ],
    prohibitedClaims: [NOT_APPLIES],
    rationale:
      'The audit lists DEMO-MATH 111 only; applicability comes from the audit, never from equivalency guesses.',
    citations: [
      ISSUE,
      'planning/08 §Candidate formation and allocation (applicability from the audit)',
    ],
  }),
  applicabilityCase({
    id: 'GC-APP-006',
    family: GoldenRuleFamily.Applicability,
    title: 'An incomplete child under a complete parent does not apply',
    requirementIds: ['FR-05', 'T03'],
    inputs: {
      courseId: MATH102,
      audit: auditWith(
        { ...COMPLETE, label: 'Mathematics elective block', candidateCourseIds: [] },
        { parentSourceRequirementId: 'REQ-001', label: 'Choose one elective' },
      ),
      freshness: FRESH_RECORD,
    },
    expected: [
      expectedCheck(APPLIES, {
        state: CheckState.Fail,
        reasonCode: ReasonCode.RequirementAlreadySatisfied,
        sourceRef: auditRequirementRef(1),
      }),
    ],
    prohibitedClaims: [NOT_APPLIES],
    rationale:
      'The parent block is complete in the audit, so its open child adds no progress; the check names the parent.',
    citations: [
      'PR #81 (tech-lead: a complete ancestor → FAIL REQUIREMENT_ALREADY_SATISFIED)',
      AUTHORITY,
    ],
  }),
  applicabilityCase({
    id: 'GC-APP-007',
    family: GoldenRuleFamily.Applicability,
    title: 'An ambiguous requirement is not masked by an outstanding one',
    requirementIds: ['FR-05', 'T03'],
    inputs: {
      courseId: MATH102,
      audit: auditWith({ state: RequirementState.Ambiguous }, { label: 'Quantitative reasoning' }),
      freshness: FRESH_RECORD,
    },
    expected: [
      expectedCheck(APPLIES, { state: CheckState.Unknown, reasonCode: ReasonCode.AuditAmbiguous }),
    ],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Fail, 'must not settle what the audit leaves open'),
    ],
    rationale:
      'Where the course counts depends on a requirement the audit leaves unsettled, so conflicting evidence stays UNKNOWN.',
    citations: [ISSUE, 'PR #81 (AMBIGUOUS is never masked by a PASS)'],
  }),
  applicabilityCase({
    id: 'GC-STALE-001',
    family: GoldenRuleFamily.AuditStale,
    title: 'A record revised after the audit is unknown',
    requirementIds: ['FR-04', 'NFR-04', 'T03', 'AC10'],
    inputs: {
      courseId: MATH102,
      audit: auditWith({}),
      freshness: pinnedRecord(
        {
          sourceEffectiveAt: '2026-09-20T09:00:00.000-05:00',
          ingestedAt: '2026-09-20T09:05:00.000-05:00',
        },
        ONE_HOUR_MS,
        2,
      ),
    },
    expected: [
      expectedCheck(APPLIES, { state: CheckState.Unknown, reasonCode: ReasonCode.AuditStale }),
    ],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Fail, 'must not decide from a mixed snapshot'),
    ],
    rationale:
      'The SIS record was revised (snapshot 2, 09:00) 90 minutes after the revision the audit ran against (snapshot 1, 07:30). The audit does not reflect the pinned record; no mixed-snapshot validation.',
    citations: [
      'planning/13 AC10',
      CONSISTENCY,
      'issue #56 (a record newer than the audit → AUDIT_STALE)',
      'PR #123 (a later revision → AUDIT_STALE)',
    ],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  applicabilityCase({
    id: 'GC-STALE-002',
    family: GoldenRuleFamily.AuditStale,
    title: 'A record exactly at the skew in another offset is still fresh',
    requirementIds: ['FR-04', 'NFR-04', 'T03', 'AC10'],
    inputs: {
      courseId: MATH102,
      audit: auditWith({}),
      freshness: pinnedRecord(
        { sourceEffectiveAt: '2026-09-20T13:30:00.000Z', ingestedAt: '2026-09-20T13:45:00.000Z' },
        ONE_HOUR_MS,
      ),
    },
    expected: [expectedCheck(APPLIES, { state: CheckState.Pass, reasonCode: null })],
    prohibitedClaims: [mustNot(CheckState.Unknown, 'must not call an audit stale within the skew')],
    rationale:
      "The audit ran against this snapshot. Its source time 13:30Z is 08:30-05:00, exactly 60 minutes after the audit's recorded 07:30-05:00: not beyond the skew. Times are instants.",
    citations: [
      'issue #56 (beyond maxSkew; compared as instants)',
      CONSISTENCY,
      'planning/13 AC10',
    ],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
];
