/**
 * @file Golden cases: in-progress retakes of passed and failed courses, and courses that share an
 *   equivalency group.
 * @module @caa/test-kit/golden/cases/retakes-and-equivalency
 * @requirement FR-06
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckState, ReasonCode, RepeatPolicy } from '@caa/domain';

import { completedAttempt, inProgressAttempt } from '../../builders/course-attempt.builder';
import { letter } from '../../builders/grade.builder';
import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { type GoldenCase } from '../golden-case.schema';
import { prerequisiteCase } from '../golden-case-factories';
import {
  courseLeaf,
  mustNot,
  NEVER_PASS_WHEN_UNKNOWN,
  prerequisiteCheck,
} from '../golden-expectations';
import { prerequisiteInputs } from '../golden-inputs';
import { GoldenRuleFamily } from '../golden-rule-family';

const IN_PROGRESS = 'planning/08 §Eligibility semantics (in-progress is conditional)';
const EQUIVALENCY = 'planning/08 §Candidate formation and allocation (never count two aliases)';
const NOT_BLOCKED = mustNot(
  CheckState.Fail,
  'must not block a student whose counting grade meets the minimum',
);
const NOT_GUESSED_FAIL = mustNot(CheckState.Fail, 'must not guess which attempt counts');
const B_THEN_RETAKE = [completedAttempt({}, 1), inProgressAttempt({}, 2)];
const D_THEN_RETAKE = [completedAttempt({ grade: letter('D') }, 1), inProgressAttempt({}, 2)];
const MATH111_B = completedAttempt({ courseId: SYNTHETIC_COURSES.math111.id }, 2);

/** Retake and equivalency cases. Rule: DEMO-MATH 102 needs DEMO-MATH 101 ≥ C. */
export const RETAKE_AND_EQUIVALENCY_CASES: readonly GoldenCase[] = [
  prerequisiteCase({
    id: 'GC-REP-008',
    family: GoldenRuleFamily.Repeat,
    title: 'A MOST_RECENT retake of a passed course makes it conditional',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.MostRecent, allowsInProgressPrerequisites: true },
      attempts: B_THEN_RETAKE,
    }),
    expected: [
      prerequisiteCheck(CheckState.Conditional, ReasonCode.InProgressMinGrade, {
        decisiveLeaves: [
          courseLeaf({
            path: [],
            courseId: SYNTHETIC_COURSES.math101.id,
            requiredGrade: letter('C'),
            attemptSeeds: [1, 2],
            reasonCode: ReasonCode.InProgressMinGrade,
          }),
        ],
      }),
    ],
    prohibitedClaims: [mustNot(CheckState.Pass, 'must not keep a B the retake will replace')],
    rationale:
      'Under MOST_RECENT the 2026FA retake will replace the B, so the rule holds only if the retake earns C.',
    citations: [
      'PR #76 (tech-lead: MOST_RECENT retake of a passed course → CONDITIONAL)',
      IN_PROGRESS,
    ],
  }),
  prerequisiteCase({
    id: 'GC-REP-009',
    family: GoldenRuleFamily.Repeat,
    title: 'A HIGHEST_GRADE retake cannot lower a passed course',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.HighestGrade, allowsInProgressPrerequisites: true },
      attempts: B_THEN_RETAKE,
    }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [NOT_BLOCKED],
    rationale: 'Under HIGHEST_GRADE the B keeps counting whatever letter the retake earns.',
    citations: [
      'PR #76 decision table (HIGHEST_GRADE retake of a passing letter → PASS)',
      'packages/domain RepeatPolicy',
    ],
  }),
  prerequisiteCase({
    id: 'GC-REP-010',
    family: GoldenRuleFamily.Repeat,
    title: 'A MOST_RECENT retake of a failed course is conditional',
    requirementIds: ['FR-06', 'T04', 'AC02'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.MostRecent, allowsInProgressPrerequisites: true },
      attempts: D_THEN_RETAKE,
    }),
    expected: [prerequisiteCheck(CheckState.Conditional, ReasonCode.InProgressMinGrade)],
    prohibitedClaims: [mustNot(CheckState.Pass, 'must not claim unconditional eligibility')],
    rationale:
      'The later retake will count under MOST_RECENT; the rule holds if it earns C and progression is permitted.',
    citations: [
      IN_PROGRESS,
      'PR #76 decision table (retake under MOST_RECENT, retake later → CONDITIONAL)',
    ],
  }),
  prerequisiteCase({
    id: 'GC-REP-011',
    family: GoldenRuleFamily.Repeat,
    title: 'A retake of a failed course with no repeat policy is unknown',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { allowsInProgressPrerequisites: true },
      attempts: D_THEN_RETAKE,
    }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.RepeatPolicyUndefined)],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Conditional, 'must not promise the retake will count'),
    ],
    rationale:
      'Without a repeat policy a C in the retake might not replace the D, so no sufficient condition can be stated.',
    citations: ['issue #54 (policy unset → UNKNOWN)', IN_PROGRESS],
  }),
  prerequisiteCase({
    id: 'GC-REP-012',
    family: GoldenRuleFamily.Repeat,
    title: 'A MOST_RECENT retake of a passed course when progression is forbidden',
    requirementIds: ['FR-06', 'T04', 'AC02'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.MostRecent },
      attempts: B_THEN_RETAKE,
    }),
    expected: [prerequisiteCheck(CheckState.Fail, ReasonCode.ProgressionNotPermitted)],
    allowedAlternatives: [
      [prerequisiteCheck(CheckState.Unknown, ReasonCode.ProgressionNotPermitted)],
    ],
    prohibitedClaims: [
      mustNot(CheckState.Pass, 'must not keep a B the retake will replace'),
      mustNot(
        CheckState.Conditional,
        'must not offer a condition on in-progress work policy forbids',
      ),
    ],
    rationale:
      'The B will be replaced by the in-progress retake, and the institution does not permit planning on in-progress work, so no condition may be offered: FAIL, or UNKNOWN as a referral.',
    citations: [
      'planning/08 §Eligibility semantics (conditional on the institution permitting planned progression)',
      'planning/13 AC02 (CONDITIONAL only if progression policy permits)',
      'PR #76 academic-safety review finding 1 (unresolved; no tech-lead sign-off recorded)',
    ],
  }),
  prerequisiteCase({
    id: 'GC-EQV-001',
    family: GoldenRuleFamily.Equivalency,
    title: 'An equivalent course satisfies the prerequisite',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({ attempts: [MATH111_B] }),
    expected: [
      prerequisiteCheck(CheckState.Pass, null, {
        decisiveLeaves: [
          courseLeaf({
            path: [],
            courseId: SYNTHETIC_COURSES.math101.id,
            requiredGrade: letter('C'),
            attemptSeeds: [2],
            reasonCode: null,
          }),
        ],
      }),
    ],
    prohibitedClaims: [NOT_BLOCKED],
    rationale: 'DEMO-MATH 111 shares equivalency group 1 with DEMO-MATH 101, and its B meets C.',
    citations: [EQUIVALENCY, 'issue #54 (groups by equivalency group)'],
  }),
  prerequisiteCase({
    id: 'GC-EQV-002',
    family: GoldenRuleFamily.Equivalency,
    title: 'A later equivalent counts as the repeat under MOST_RECENT',
    requirementIds: ['FR-06', 'T04', 'AC04'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.MostRecent },
      attempts: [completedAttempt({ grade: letter('D'), termCode: '2025FA' }, 1), MATH111_B],
    }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [NOT_BLOCKED],
    rationale:
      'Aliases are one course for repeats: the 2026SP DEMO-MATH 111 B replaces the 2025FA D.',
    citations: [EQUIVALENCY, 'planning/13 AC04'],
  }),
  prerequisiteCase({
    id: 'GC-EQV-003',
    family: GoldenRuleFamily.Equivalency,
    title: 'Two equivalents with no repeat policy are unknown',
    requirementIds: ['FR-06', 'T04', 'AC04'],
    inputs: prerequisiteInputs({
      attempts: [completedAttempt({ grade: letter('D'), termCode: '2025FA' }, 1), MATH111_B],
    }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.RepeatPolicyUndefined)],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_GUESSED_FAIL],
    rationale:
      'The two aliases are repeats of one course; with no repeat policy neither may be chosen.',
    citations: [EQUIVALENCY, 'issue #54 (policy unset → UNKNOWN)'],
  }),
];
