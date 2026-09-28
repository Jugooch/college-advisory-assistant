/**
 * @file Golden cases: completed repeats of one course under MOST_RECENT, HIGHEST_GRADE, and no
 *   repeat policy, including ties and mixed grade schemes.
 * @module @caa/test-kit/golden/cases/repeats
 * @requirement FR-06
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckState, type Grade, ReasonCode, RepeatPolicy } from '@caa/domain';

import { completedAttempt } from '../../builders/course-attempt.builder';
import { letter, pass } from '../../builders/grade.builder';
import { type GoldenCase } from '../golden-case.schema';
import { prerequisiteCase } from '../golden-case-factories';
import { mustNot, NEVER_PASS_WHEN_UNKNOWN, prerequisiteCheck } from '../golden-expectations';
import { prerequisiteInputs } from '../golden-inputs';
import { GoldenRuleFamily } from '../golden-rule-family';

const REPEATS = 'planning/08 §Candidate formation and allocation (repeats need attempt identities)';
const REPEAT_POLICY =
  'packages/domain RepeatPolicy (MOST_RECENT: latest term; HIGHEST_GRADE: highest grade)';
const NOT_ELIGIBLE = mustNot(CheckState.Pass, 'must not claim the prerequisite is met');
const NOT_BLOCKED = mustNot(
  CheckState.Fail,
  'must not block a student whose counting grade meets the minimum',
);
const NOT_GUESSED_FAIL = mustNot(CheckState.Fail, 'must not guess which repeat counts');

/**
 * Two completed DEMO-MATH 101 attempts: seed 1 and seed 2.
 *
 * @param first - Grade and term of attempt 1.
 * @param second - Grade and term of attempt 2.
 * @returns The two attempts, in that order.
 */
function twoAttempts(
  first: readonly [Grade, string],
  second: readonly [Grade, string],
): ReturnType<typeof completedAttempt>[] {
  return [
    completedAttempt({ grade: first[0], termCode: first[1] }, 1),
    completedAttempt({ grade: second[0], termCode: second[1] }, 2),
  ];
}

/** Completed-repeat cases. Rule: DEMO-MATH 102 needs DEMO-MATH 101 ≥ C. */
export const REPEAT_CASES: readonly GoldenCase[] = [
  prerequisiteCase({
    id: 'GC-REP-001',
    family: GoldenRuleFamily.Repeat,
    title: 'MOST_RECENT counts a later B over an earlier D',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.MostRecent },
      attempts: twoAttempts([letter('D'), '2025FA'], [letter('B'), '2026SP']),
    }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [NOT_BLOCKED],
    rationale: 'The 2026SP attempt is the latest and counts; B meets C.',
    citations: [REPEAT_POLICY, REPEATS],
  }),
  prerequisiteCase({
    id: 'GC-REP-002',
    family: GoldenRuleFamily.Repeat,
    title: 'MOST_RECENT counts a later D even over an earlier B',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.MostRecent },
      attempts: twoAttempts([letter('B'), '2025FA'], [letter('D'), '2026SP']),
    }),
    expected: [prerequisiteCheck(CheckState.Fail, ReasonCode.MinGradeNotMet)],
    prohibitedClaims: [NOT_ELIGIBLE],
    rationale: 'MOST_RECENT counts the latest attempt whatever its grade; D is below C.',
    citations: [REPEAT_POLICY, REPEATS],
  }),
  prerequisiteCase({
    id: 'GC-REP-003',
    family: GoldenRuleFamily.Repeat,
    title: 'HIGHEST_GRADE counts an earlier B over a later D',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.HighestGrade },
      attempts: twoAttempts([letter('B'), '2025FA'], [letter('D'), '2026SP']),
    }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [NOT_BLOCKED],
    rationale: 'HIGHEST_GRADE counts the B; B meets C.',
    citations: [REPEAT_POLICY, REPEATS],
  }),
  prerequisiteCase({
    id: 'GC-REP-004',
    family: GoldenRuleFamily.Repeat,
    title: 'A repeat with no repeat policy is unknown',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      attempts: twoAttempts([letter('D'), '2025FA'], [letter('B'), '2026SP']),
    }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.RepeatPolicyUndefined)],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_GUESSED_FAIL],
    rationale:
      'D fails and B passes; which counts is institutional policy, and the policy is silent.',
    citations: ['issue #54 (policy unset → UNKNOWN instead of guessing)', REPEATS],
  }),
  prerequisiteCase({
    id: 'GC-REP-005',
    family: GoldenRuleFamily.Repeat,
    title: 'MOST_RECENT cannot order two attempts in the same term',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.MostRecent },
      attempts: twoAttempts([letter('B'), '2026SP'], [letter('D'), '2026SP']),
    }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.RepeatOrderUndetermined)],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_GUESSED_FAIL],
    rationale:
      'Both attempts share a term, so "most recent" is tied; input order is not an institutional fact.',
    citations: [
      'packages/domain ReasonCode (REPEAT_ORDER_UNDETERMINED: tied terms)',
      'PR #64 (ties → UNDETERMINED)',
    ],
  }),
  prerequisiteCase({
    id: 'GC-REP-006',
    family: GoldenRuleFamily.Repeat,
    title: 'HIGHEST_GRADE with two equal grades is a tie',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.HighestGrade },
      attempts: twoAttempts([letter('B'), '2025FA'], [letter('B'), '2026SP']),
    }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.RepeatOrderUndetermined)],
    allowedAlternatives: [[prerequisiteCheck(CheckState.Pass, null)]],
    prohibitedClaims: [NOT_BLOCKED],
    rationale:
      'The tie leaves no single counting attempt (UNKNOWN); PASS is also acceptable because both tied grades meet C.',
    citations: [
      'packages/domain ReasonCode (REPEAT_ORDER_UNDETERMINED: tied grades)',
      'PR #64 (ties → UNDETERMINED)',
    ],
  }),
  prerequisiteCase({
    id: 'GC-REP-007',
    family: GoldenRuleFamily.Repeat,
    title: 'HIGHEST_GRADE cannot rank a P against a D',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.HighestGrade, passSatisfiesMinimumGrade: true },
      attempts: twoAttempts([pass(), '2025FA'], [letter('D'), '2026SP']),
    }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.RepeatOrderUndetermined)],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_GUESSED_FAIL],
    rationale:
      'P would pass and D would fail; P and letters are separate schemes, so "highest" is undefined.',
    citations: [
      'planning/08 §Candidate formation and allocation (preserve grade schemes)',
      'PR #64 (mixed schemes → UNDETERMINED)',
    ],
  }),
];
