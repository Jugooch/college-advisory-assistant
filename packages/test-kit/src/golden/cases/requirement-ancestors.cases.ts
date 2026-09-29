/**
 * @file Golden cases: requirement applicability decided by an ancestor's state (in progress,
 *   ambiguous, complete), and the same trees read from an audit that is stale for the record.
 * @module @caa/test-kit/golden/cases/requirement-ancestors
 * @requirement FR-04
 * @requirement FR-05
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/07-system-architecture-and-design.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import {
  CheckKind,
  CheckState,
  ReasonCode,
  type RequirementResultInput,
  RequirementState,
} from '@caa/domain';

import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { type GoldenCase } from '../golden-case.schema';
import { applicabilityCase } from '../golden-case-factories';
import { expectedCheck, mustNot, NEVER_PASS_WHEN_UNKNOWN } from '../golden-expectations';
import {
  auditRequirementRef,
  auditWith,
  FRESH_RECORD,
  pinnedRecord,
  S3_INTERACTIONS_ADJUDICATED_ON,
} from '../golden-inputs';
import { GoldenRuleFamily } from '../golden-rule-family';

const MATH102 = SYNTHETIC_COURSES.math102.id;
const APPLIES = CheckKind.RequirementApplicability;
const TREE = 'PR #81 (tech-lead: the most settled state on the ancestor chain decides)';
const AUTHORITY = 'planning/08 §Authority and result semantics (the audit owns allocation)';
const CONSISTENCY = 'planning/07 §Consistency model (record newer than the audit → UNKNOWN)';
const ONE_HOUR_MS = 3_600_000;
const COMPLETE = {
  state: RequirementState.Complete,
  remainingCreditsHundredths: 0,
  remainingCourseCount: 0,
};
/** An open child of REQ-001 that lists DEMO-MATH 102. */
const OPEN_CHILD: Partial<RequirementResultInput> = {
  parentSourceRequirementId: 'REQ-001',
  label: 'Choose one elective',
};
/** A record revised at 09:00-05:00, 90 minutes after the audit's record (GC-STALE-001). */
const REVISED_RECORD = pinnedRecord(
  {
    sourceEffectiveAt: '2026-09-20T09:00:00.000-05:00',
    ingestedAt: '2026-09-20T09:05:00.000-05:00',
  },
  ONE_HOUR_MS,
  2,
);
const NOT_DECIDED = mustNot(CheckState.Fail, 'must not settle what the audit leaves open');
const STALE = expectedCheck(APPLIES, {
  state: CheckState.Unknown,
  reasonCode: ReasonCode.AuditStale,
});

/**
 * Builds a parent block (REQ-001, listing no course) in the given state over {@link OPEN_CHILD}.
 *
 * @param parent - The parent's state and quantities.
 * @returns The audit.
 */
function parentOver(parent: Partial<RequirementResultInput>): ReturnType<typeof auditWith> {
  return auditWith(
    { label: 'Mathematics elective block', candidateCourseIds: [], ...parent },
    OPEN_CHILD,
  );
}

/** Applicability × ancestor state × staleness cases. The course placed is DEMO-MATH 102. */
export const REQUIREMENT_ANCESTOR_CASES: readonly GoldenCase[] = [
  applicabilityCase({
    id: 'GC-APP-008',
    family: GoldenRuleFamily.Applicability,
    title: 'An open child under an in-progress parent is conditional',
    requirementIds: ['FR-05', 'T03'],
    inputs: {
      courseId: MATH102,
      audit: parentOver({ state: RequirementState.InProgress }),
      freshness: FRESH_RECORD,
    },
    expected: [
      expectedCheck(APPLIES, {
        state: CheckState.Conditional,
        reasonCode: ReasonCode.RequirementInProgress,
        sourceRef: auditRequirementRef(1),
      }),
    ],
    prohibitedClaims: [
      mustNot(CheckState.Pass, 'must not claim progress on a block current work may finish'),
      mustNot(CheckState.Fail, 'must not deny progress on a block that is not complete'),
    ],
    rationale:
      'The block is in progress in the audit: current courses may complete it, so the open child counts only if they don’t. The check is conditional and names the block.',
    citations: [TREE, 'issue #84 (IN_PROGRESS → CONDITIONAL REQUIREMENT_IN_PROGRESS)', AUTHORITY],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
  applicabilityCase({
    id: 'GC-APP-009',
    family: GoldenRuleFamily.Applicability,
    title: 'An open child under an ambiguous parent is unknown',
    requirementIds: ['FR-05', 'T03'],
    inputs: {
      courseId: MATH102,
      audit: parentOver({ state: RequirementState.Ambiguous }),
      freshness: FRESH_RECORD,
    },
    expected: [
      expectedCheck(APPLIES, {
        state: CheckState.Unknown,
        reasonCode: ReasonCode.AuditAmbiguous,
        sourceRef: auditRequirementRef(1),
      }),
    ],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_DECIDED],
    rationale:
      'The audit does not settle the block, so whether its open child still advances anything is unknown.',
    citations: [TREE, 'PR #81 (AMBIGUOUS is never masked by a PASS)', AUTHORITY],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
  applicabilityCase({
    id: 'GC-APP-010',
    family: GoldenRuleFamily.Applicability,
    title: 'An ambiguous grandparent outranks a complete parent',
    requirementIds: ['FR-05', 'T03'],
    inputs: {
      courseId: MATH102,
      audit: auditWith(
        { state: RequirementState.Ambiguous, label: 'Major core', candidateCourseIds: [] },
        {
          ...COMPLETE,
          parentSourceRequirementId: 'REQ-001',
          label: 'Mathematics elective block',
          candidateCourseIds: [],
        },
        { parentSourceRequirementId: 'REQ-002', label: 'Choose one elective' },
      ),
      freshness: FRESH_RECORD,
    },
    expected: [
      expectedCheck(APPLIES, {
        state: CheckState.Unknown,
        reasonCode: ReasonCode.AuditAmbiguous,
        sourceRef: auditRequirementRef(1),
      }),
    ],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Fail, 'must not close the block while the audit leaves its parent open'),
    ],
    rationale:
      'The block says complete, but the core it belongs to is ambiguous in the audit, so neither "already satisfied" nor "applies" is supported.',
    citations: [TREE, 'PR #81 (an AMBIGUOUS ancestor gives UNKNOWN, even over a COMPLETE parent)'],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
  applicabilityCase({
    id: 'GC-STALE-006',
    family: GoldenRuleFamily.AuditStale,
    title: 'A stale audit does not deny a course under a complete parent',
    requirementIds: ['FR-04', 'NFR-04', 'T03', 'AC10'],
    inputs: { courseId: MATH102, audit: parentOver(COMPLETE), freshness: REVISED_RECORD },
    expected: [STALE],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Fail, 'must not deny progress from an audit older than the record'),
    ],
    rationale:
      'The block was complete when the audit ran, but the record changed 90 minutes later, beyond the one-hour skew. A denial from that audit is as unsupported as an approval.',
    citations: ['planning/13 AC10', CONSISTENCY, 'issue #56 (a stale snapshot never passes)'],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
  applicabilityCase({
    id: 'GC-STALE-007',
    family: GoldenRuleFamily.AuditStale,
    title: 'A stale audit does not offer a condition from an in-progress parent',
    requirementIds: ['FR-04', 'NFR-04', 'T03', 'AC10'],
    inputs: {
      courseId: MATH102,
      audit: parentOver({ state: RequirementState.InProgress }),
      freshness: REVISED_RECORD,
    },
    expected: [STALE],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Conditional, 'must not state a condition read from a stale audit'),
      NOT_DECIDED,
    ],
    rationale:
      'The condition would come from the in-progress block, but the audit is stale for the revised record, so no condition from it is sufficient.',
    citations: [
      'planning/13 AC10',
      CONSISTENCY,
      'PR #81 (a stale audit is UNKNOWN AUDIT_STALE whatever the requirements say)',
    ],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
];
