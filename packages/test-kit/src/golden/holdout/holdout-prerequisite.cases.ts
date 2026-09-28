/**
 * @file Frozen holdout cases for prerequisite evaluation. Kept out of engine development; see
 *   README.md in this folder before reading further.
 * @module @caa/test-kit/golden/holdout/holdout-prerequisite
 * @requirement FR-06
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckState, ReasonCode } from '@caa/domain';

import {
  completedAttempt,
  inProgressAttempt,
  transferAwardedAttempt,
} from '../../builders/course-attempt.builder';
import { fail, letter } from '../../builders/grade.builder';
import {
  all,
  any,
  buildPrerequisiteRule,
  course,
  unsupported,
} from '../../builders/prerequisite-rule.builder';
import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { type GoldenCase } from '../golden-case.schema';
import { prerequisiteCase } from '../golden-case-factories';
import { mustNot, NEVER_PASS_WHEN_UNKNOWN, prerequisiteCheck } from '../golden-expectations';
import { prerequisiteInputs } from '../golden-inputs';
import { GoldenRuleFamily } from '../golden-rule-family';

const PHYS = SYNTHETIC_COURSES.phys201.id;
const NOT_ELIGIBLE = mustNot(CheckState.Pass, 'must not claim the prerequisite is met');
const NOT_BLOCKED = mustNot(CheckState.Fail, 'must not block a student who met the minimum');

/** Holdout prerequisite cases. */
export const HOLDOUT_PREREQUISITE_CASES: readonly GoldenCase[] = [
  prerequisiteCase({
    id: 'GH-MIN-001',
    family: GoldenRuleFamily.MinimumGrade,
    title: 'An A- meets a B+ minimum',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      rule: buildPrerequisiteRule({
        expression: course(SYNTHETIC_COURSES.math101.id, letter('B+')),
      }),
      attempts: [completedAttempt({ grade: letter('A-') })],
    }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [NOT_BLOCKED],
    rationale: 'A- ranks above B+ in the policy order.',
    citations: ['planning/08 §Eligibility semantics', 'issue #54'],
  }),
  prerequisiteCase({
    id: 'GH-PF-001',
    family: GoldenRuleFamily.PassFailEquivalence,
    title: 'A pass/fail F fails a C minimum even with equivalence undefined',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({ attempts: [completedAttempt({ grade: fail() })] }),
    expected: [prerequisiteCheck(CheckState.Fail, ReasonCode.MinGradeNotMet)],
    prohibitedClaims: [NOT_ELIGIBLE],
    rationale:
      'A failing grade never meets a minimum, whatever the pass-equivalence policy says about P.',
    citations: [
      'issue #71 (a failing grade never passes)',
      'PR #64 (pass/fail F → MIN_GRADE_NOT_MET)',
    ],
  }),
  prerequisiteCase({
    id: 'GH-TRN-001',
    family: GoldenRuleFamily.PendingTransfer,
    title: 'An awarded transfer with a B satisfies the prerequisite',
    requirementIds: ['FR-06', 'T04', 'AC03'],
    inputs: prerequisiteInputs({ attempts: [transferAwardedAttempt({ grade: letter('B') })] }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [NOT_BLOCKED],
    rationale:
      'Once approved credit exists, the transfer counts like any grade that meets the minimum.',
    citations: [
      'planning/13 AC03 (UNKNOWN until approved credit exists)',
      'planning/08 §Eligibility semantics',
    ],
  }),
  prerequisiteCase({
    id: 'GH-TRN-002',
    family: GoldenRuleFamily.PendingTransfer,
    title: 'An awarded transfer with no grade is unknown against a C minimum',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({ attempts: [transferAwardedAttempt()] }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.GradeNotRecorded)],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Fail, 'must not presume the grade was low'),
    ],
    rationale:
      'The credit was awarded but no grade was recorded, so the C minimum cannot be checked.',
    citations: [
      'packages/domain ReasonCode (GRADE_NOT_RECORDED)',
      'planning/08 §Authority and result semantics',
    ],
  }),
  prerequisiteCase({
    id: 'GH-EXP-001',
    family: GoldenRuleFamily.AndOrExpression,
    title: 'OR of a conditional AND and an unsupported rule is conditional',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { allowsInProgressPrerequisites: true },
      rule: buildPrerequisiteRule({
        expression: any(
          all(course(SYNTHETIC_COURSES.math101.id, letter('C')), course(PHYS, letter('C'))),
          unsupported('Consent of department chair'),
        ),
      }),
      attempts: [completedAttempt({}, 1), inProgressAttempt({ courseId: PHYS }, 2)],
    }),
    expected: [prerequisiteCheck(CheckState.Conditional, ReasonCode.InProgressMinGrade)],
    prohibitedClaims: [mustNot(CheckState.Pass, 'must not claim unconditional eligibility')],
    rationale: 'The AND holds if DEMO-PHYS 201 earns C, a sufficient stated condition for the OR.',
    citations: ['issue #55 (ALL/ANY truth tables)', 'planning/08 §Eligibility semantics'],
  }),
];
