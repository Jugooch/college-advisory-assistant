/**
 * @file Frozen holdout cases for interactions between rule families (added in holdout v0.2):
 *   pending transfer × repeat policy, pass/fail × passing cutoff, requirement ancestors ×
 *   staleness, and allocation × variable credit. Kept out of engine development; see README.md in
 *   this folder before reading further.
 * @module @caa/tests/golden/holdout/holdout-interactions
 * @requirement FR-04
 * @requirement FR-05
 * @requirement FR-06
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import {
  CheckKind,
  CheckState,
  LetterGrade,
  ReasonCode,
  RepeatPolicy,
  RequirementState,
} from '@caa/domain';
import {
  allocationCase,
  applicabilityCase,
  auditRequirementRef,
  auditWith,
  completedAttempt,
  expectedCheck,
  FRESH_RECORD,
  type GoldenCase,
  GoldenRuleFamily,
  inProgressAttempt,
  letter,
  mustNot,
  NEVER_PASS_WHEN_UNKNOWN,
  pass,
  pendingTransferAttempt,
  pinnedRecord,
  planned,
  prerequisiteCase,
  prerequisiteCheck,
  prerequisiteInputs,
  S3_INTERACTIONS_ADJUDICATED_ON,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

const { math102, phys201, ind390 } = SYNTHETIC_COURSES;
const ALLOCATES = CheckKind.RequirementAllocation;
const APPLIES = CheckKind.RequirementApplicability;
const ON = S3_INTERACTIONS_ADJUDICATED_ON;
const NOT_ENGINE_FAIL = mustNot(CheckState.Fail, 'must not decide an allocation the audit owns');
/** A requirement listing DEMO-PHYS 201 and DEMO-IND 390 with two courses left. */
const PHYS_AND_IND = { candidateCourseIds: [phys201.id, ind390.id], remainingCourseCount: 2 };

/** Holdout interaction cases. */
export const HOLDOUT_INTERACTION_CASES: readonly GoldenCase[] = [
  prerequisiteCase({
    id: 'GH-PT-001',
    family: GoldenRuleFamily.PendingTransfer,
    title: 'Under HIGHEST_GRADE, a pending transfer keeps a failed F open',
    requirementIds: ['FR-06', 'T04', 'AC03'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.HighestGrade },
      attempts: [
        completedAttempt({ grade: letter('F'), termCode: '2025FA' }, 1),
        pendingTransferAttempt({ termCode: '2026SP' }, 2),
      ],
    }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.PendingTransfer)],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Fail, 'must not settle as failed while a transfer is pending'),
    ],
    rationale:
      'The F alone fails, but under HIGHEST_GRADE a transfer awarded with C or higher would count instead.',
    citations: ['planning/13 AC03', 'planning/08 §Eligibility semantics'],
    adjudicatedOn: ON,
  }),
  prerequisiteCase({
    id: 'GH-REP-001',
    family: GoldenRuleFamily.Repeat,
    title: 'Under MOST_RECENT, a latest retake after a D is conditional beside a pending transfer',
    requirementIds: ['FR-06', 'T04', 'AC02'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.MostRecent, allowsInProgressPrerequisites: true },
      attempts: [
        completedAttempt({ grade: letter('D'), termCode: '2025FA' }, 1),
        inProgressAttempt({}, 2),
        pendingTransferAttempt({ termCode: '2026SP' }, 3),
      ],
    }),
    expected: [prerequisiteCheck(CheckState.Conditional, ReasonCode.InProgressMinGrade)],
    allowedAlternatives: [[prerequisiteCheck(CheckState.Unknown, ReasonCode.PendingTransfer)]],
    prohibitedClaims: [
      mustNot(CheckState.Pass, 'must not claim eligibility before the retake is graded'),
      mustNot(CheckState.Fail, 'must not block a retake that can still satisfy the rule'),
    ],
    rationale:
      'The 2026FA retake is later than the D (2025FA) and the pending transfer (2026SP), so under MOST_RECENT its grade decides: "if you earn C" is sufficient. UNKNOWN is also safe.',
    citations: [
      'planning/08 §Authority and result semantics (CONDITIONAL: "If you earn C or higher …")',
      'planning/08 §Eligibility semantics',
    ],
    adjudicatedOn: ON,
  }),
  prerequisiteCase({
    id: 'GH-PF-002',
    family: GoldenRuleFamily.PassFailEquivalence,
    title: 'A C cutoff does not rescue a P when policy denies equivalence',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { passSatisfiesMinimumGrade: false, lowestPassingLetterGrade: LetterGrade.C },
      attempts: [completedAttempt({ grade: pass() })],
    }),
    expected: [prerequisiteCheck(CheckState.Fail, ReasonCode.MinGradeNotMet)],
    prohibitedClaims: [mustNot(CheckState.Pass, 'must not count a P the policy says falls short')],
    rationale:
      'The policy says a P does not satisfy a minimum grade; the passing cutoff changes nothing about a C minimum.',
    citations: ['planning/08 §Candidate formation and allocation', 'issue #69'],
    adjudicatedOn: ON,
  }),
  applicabilityCase({
    id: 'GH-APP-002',
    family: GoldenRuleFamily.Applicability,
    title: 'An in-progress grandparent makes an open grandchild conditional',
    requirementIds: ['FR-05', 'T03'],
    inputs: {
      courseId: math102.id,
      audit: auditWith(
        { state: RequirementState.InProgress, label: 'Major core', candidateCourseIds: [] },
        { parentSourceRequirementId: 'REQ-001', label: 'Mathematics', candidateCourseIds: [] },
        { parentSourceRequirementId: 'REQ-002', label: 'Choose one' },
      ),
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
      mustNot(CheckState.Pass, 'must not claim progress current work may make unnecessary'),
    ],
    rationale:
      'Two levels up, the core is in progress in the audit, so the open grandchild counts only if current work does not finish the core.',
    citations: ['issue #56', 'issue #84', 'planning/08 §Authority and result semantics'],
    adjudicatedOn: ON,
  }),
  applicabilityCase({
    id: 'GH-STALE-001',
    family: GoldenRuleFamily.AuditStale,
    title: 'A complete requirement read from a stale audit is unknown, not satisfied',
    requirementIds: ['FR-04', 'NFR-04', 'T03', 'AC10'],
    inputs: {
      courseId: math102.id,
      audit: auditWith({
        state: RequirementState.Complete,
        remainingCreditsHundredths: 0,
        remainingCourseCount: 0,
      }),
      freshness: pinnedRecord({
        sourceEffectiveAt: '2026-09-20T12:30:00.001Z',
        ingestedAt: '2026-09-20T12:45:00.000Z',
      }),
    },
    expected: [
      expectedCheck(APPLIES, { state: CheckState.Unknown, reasonCode: ReasonCode.AuditStale }),
    ],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Fail, 'must not deny progress from a stale audit'),
    ],
    rationale:
      "The record time 12:30:00.001Z is 1 ms after the audit's 07:30-05:00, and no skew is allowed, so the audit's COMPLETE is not current evidence.",
    citations: ['planning/13 AC10', 'planning/07 §Consistency model'],
    adjudicatedOn: ON,
  }),
  allocationCase({
    id: 'GH-ALLOC-002',
    family: GoldenRuleFamily.VariableCredit,
    title: 'A chosen 3.00 credits beside a 4.00 course fills 7.00 exactly',
    requirementIds: ['FR-05', 'T03', 'AC18'],
    inputs: {
      candidates: [planned(phys201), planned(ind390, 300)],
      audit: auditWith({ ...PHYS_AND_IND, remainingCreditsHundredths: 700 }),
      freshness: FRESH_RECORD,
    },
    expected: [expectedCheck(ALLOCATES, { state: CheckState.Pass, reasonCode: null })],
    prohibitedClaims: [mustNot(CheckState.Unknown, 'must not invent a contest when both fit')],
    rationale: '4.00 + 3.00 = 7.00, exactly the credits remaining.',
    citations: ['planning/08 §Candidate formation and allocation', 'planning/13 AC18'],
    adjudicatedOn: ON,
  }),
  allocationCase({
    id: 'GH-ALLOC-003',
    family: GoldenRuleFamily.VariableCredit,
    title: 'An unchosen variable credit beside a 4.00 course could overflow 6.00',
    requirementIds: ['FR-05', 'T03', 'AC05', 'AC18'],
    inputs: {
      candidates: [planned(phys201), planned(ind390)],
      audit: auditWith({ ...PHYS_AND_IND, remainingCreditsHundredths: 600 }),
      freshness: FRESH_RECORD,
    },
    expected: [
      expectedCheck(ALLOCATES, {
        state: CheckState.Unknown,
        reasonCode: ReasonCode.AllocationConflict,
        sourceRef: auditRequirementRef(1),
        evidence: { courseIds: [phys201.id, ind390.id] },
      }),
    ],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_ENGINE_FAIL],
    rationale:
      '4.00 plus 1.00 to 3.00 is 5.00 to 7.00 against 6.00 remaining; the fit holds for some choices only.',
    citations: ['planning/08 §Candidate formation and allocation', 'planning/13 AC05'],
    adjudicatedOn: ON,
  }),
];
