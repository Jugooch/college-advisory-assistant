/**
 * @file Golden cases: letter grades against a letter minimum, and a `P` against a letter minimum.
 * @module @caa/test-kit/golden/cases/minimum-grade
 * @requirement FR-06
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckState, ReasonCode } from '@caa/domain';

import { completedAttempt, withdrawnAttempt } from '../../builders/course-attempt.builder';
import { letter, pass } from '../../builders/grade.builder';
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

const ELIGIBILITY = 'planning/08 §Eligibility semantics';
const NOT_ELIGIBLE = mustNot(CheckState.Pass, 'must not claim the prerequisite is met');
const NOT_CONDITIONAL = mustNot(CheckState.Conditional, 'must not offer a condition to meet');
const NOT_FAILED = mustNot(CheckState.Fail, 'must not block a student who met the minimum');

/** Minimum-grade and pass/fail equivalence cases. Rule: DEMO-MATH 102 needs DEMO-MATH 101 ≥ C. */
export const MINIMUM_GRADE_CASES: readonly GoldenCase[] = [
  prerequisiteCase({
    id: 'GC-MIN-001',
    family: GoldenRuleFamily.MinimumGrade,
    title: 'A D against a C minimum fails',
    requirementIds: ['FR-06', 'T04', 'AC01'],
    inputs: prerequisiteInputs({ attempts: [completedAttempt({ grade: letter('D') })] }),
    expected: [
      prerequisiteCheck(CheckState.Fail, ReasonCode.MinGradeNotMet, {
        rulesetVersion: 'demo-2026.1',
        decisiveLeaves: [
          courseLeaf({
            path: [],
            courseId: SYNTHETIC_COURSES.math101.id,
            requiredGrade: letter('C'),
            attemptSeeds: [1],
            reasonCode: ReasonCode.MinGradeNotMet,
          }),
        ],
      }),
    ],
    prohibitedClaims: [NOT_ELIGIBLE, NOT_CONDITIONAL],
    rationale: 'D ranks below C in the policy order, so the known rule is violated.',
    citations: ['planning/13 AC01', ELIGIBILITY, 'issue #55 (leaf below the minimum)'],
  }),
  prerequisiteCase({
    id: 'GC-MIN-002',
    family: GoldenRuleFamily.MinimumGrade,
    title: 'A C against a C minimum passes at the boundary',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({ attempts: [completedAttempt({ grade: letter('C') })] }),
    expected: [
      prerequisiteCheck(CheckState.Pass, null, {
        decisiveLeaves: [
          courseLeaf({
            path: [],
            courseId: SYNTHETIC_COURSES.math101.id,
            requiredGrade: letter('C'),
            attemptSeeds: [1],
            reasonCode: null,
          }),
        ],
      }),
    ],
    prohibitedClaims: [NOT_FAILED],
    rationale: 'A minimum is inclusive: a grade equal to the minimum meets it.',
    citations: [ELIGIBILITY, 'issue #55 (completed attempt meeting the minimum)'],
  }),
  prerequisiteCase({
    id: 'GC-MIN-003',
    family: GoldenRuleFamily.MinimumGrade,
    title: 'A C- one step below a C minimum fails',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({ attempts: [completedAttempt({ grade: letter('C-') })] }),
    expected: [prerequisiteCheck(CheckState.Fail, ReasonCode.MinGradeNotMet)],
    prohibitedClaims: [NOT_ELIGIBLE],
    rationale: 'C- ranks directly below C in the policy order; plus/minus steps are not rounded.',
    citations: [ELIGIBILITY, 'issue #54 (letter vs letter uses policy.letterGradeOrder)'],
  }),
  prerequisiteCase({
    id: 'GC-MIN-004',
    family: GoldenRuleFamily.MinimumGrade,
    title: 'No attempt of the required course fails',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs(),
    expected: [
      prerequisiteCheck(CheckState.Fail, ReasonCode.NoQualifyingAttempt, {
        decisiveLeaves: [
          courseLeaf({
            path: [],
            courseId: SYNTHETIC_COURSES.math101.id,
            requiredGrade: letter('C'),
            attemptSeeds: [],
            reasonCode: ReasonCode.NoQualifyingAttempt,
          }),
        ],
      }),
    ],
    prohibitedClaims: [NOT_ELIGIBLE, NOT_CONDITIONAL],
    rationale: 'The record is complete and shows no attempt, so the known rule is violated.',
    citations: [ELIGIBILITY, 'issue #55 (no attempt → FAIL NO_QUALIFYING_ATTEMPT)'],
  }),
  prerequisiteCase({
    id: 'GC-MIN-005',
    family: GoldenRuleFamily.MinimumGrade,
    title: 'A withdrawn attempt earns nothing and fails',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({ attempts: [withdrawnAttempt()] }),
    expected: [prerequisiteCheck(CheckState.Fail, ReasonCode.NoQualifyingAttempt)],
    prohibitedClaims: [NOT_ELIGIBLE, NOT_CONDITIONAL],
    rationale: 'A withdrawal after add/drop earns no credit and no grade, so nothing qualifies.',
    citations: [ELIGIBILITY, 'packages/domain AttemptStatus (WITHDRAWN earns no credits)'],
  }),
  prerequisiteCase({
    id: 'GC-PF-001',
    family: GoldenRuleFamily.PassFailEquivalence,
    title: 'A P against a C minimum is unknown when policy is silent',
    requirementIds: ['FR-06', 'T04', 'AC19'],
    inputs: prerequisiteInputs({ attempts: [completedAttempt({ grade: pass() })] }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.PassEquivalenceUndefined)],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Fail, 'must not presume P fails'),
    ],
    rationale:
      '"P" is not a numeric C unless policy says so; with passSatisfiesMinimumGrade null, neither PASS nor FAIL is known.',
    citations: [
      'planning/13 AC19',
      'planning/08 §Candidate formation and allocation (grade schemes)',
      'issue #54',
    ],
  }),
  prerequisiteCase({
    id: 'GC-PF-002',
    family: GoldenRuleFamily.PassFailEquivalence,
    title: 'A P against a C minimum passes when policy grants equivalence',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { passSatisfiesMinimumGrade: true },
      attempts: [completedAttempt({ grade: pass() })],
    }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [NOT_FAILED],
    rationale: 'Policy explicitly provides that P meets a letter minimum for this check.',
    citations: [
      'planning/08 §Candidate formation and allocation (explicit equivalence)',
      'issue #54',
    ],
  }),
  prerequisiteCase({
    id: 'GC-PF-003',
    family: GoldenRuleFamily.PassFailEquivalence,
    title: 'A P against a C minimum fails when policy denies equivalence',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { passSatisfiesMinimumGrade: false },
      attempts: [completedAttempt({ grade: pass() })],
    }),
    expected: [prerequisiteCheck(CheckState.Fail, ReasonCode.MinGradeNotMet)],
    prohibitedClaims: [NOT_ELIGIBLE],
    rationale: 'Policy explicitly says P does not meet a letter minimum, so the rule is violated.',
    citations: ['issue #54 (passSatisfiesMinimumGrade false → FAIL)', ELIGIBILITY],
  }),
];
