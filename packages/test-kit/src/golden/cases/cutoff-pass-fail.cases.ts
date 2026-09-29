/**
 * @file Golden cases: the policy's passing cutoff combined with pass/fail grades and with a
 *   minimum grade. A letter cutoff never defines what a P is worth, and never lowers a minimum.
 * @module @caa/test-kit/golden/cases/cutoff-pass-fail
 * @requirement FR-06
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckState, LetterGrade, ReasonCode } from '@caa/domain';

import { completedAttempt } from '../../builders/course-attempt.builder';
import { fail, letter, pass } from '../../builders/grade.builder';
import { buildPrerequisiteRule, course } from '../../builders/prerequisite-rule.builder';
import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { type GoldenCase } from '../golden-case.schema';
import { prerequisiteCase } from '../golden-case-factories';
import { mustNot, NEVER_PASS_WHEN_UNKNOWN, prerequisiteCheck } from '../golden-expectations';
import { prerequisiteInputs, S3_INTERACTIONS_ADJUDICATED_ON } from '../golden-inputs';
import { GoldenRuleFamily } from '../golden-rule-family';

const ANY_PASSING = buildPrerequisiteRule({ expression: course(SYNTHETIC_COURSES.math101.id) });
const P_IS_NOT_C =
  'planning/08 §Candidate formation and allocation ("P" is not a numeric C unless policy explicitly provides equivalence)';
const CUTOFF_DECISION = 'issue #69 (tech-lead decision: lowestPassingLetterGrade contract)';
const NOT_ELIGIBLE = mustNot(CheckState.Pass, 'must not claim the prerequisite is met');
const P_NOT_FAILED = mustNot(CheckState.Fail, 'must not treat a P as a failing grade');
const EQUIVALENCE_UNDEFINED = prerequisiteCheck(
  CheckState.Unknown,
  ReasonCode.PassEquivalenceUndefined,
);

/** Passing cutoff × pass/fail and cutoff × minimum-grade cases. */
export const CUTOFF_PASS_FAIL_CASES: readonly GoldenCase[] = [
  prerequisiteCase({
    id: 'GC-PF-004',
    family: GoldenRuleFamily.PassFailEquivalence,
    title: 'A P under "any passing completion" is unknown when only a letter cutoff is set',
    requirementIds: ['FR-06', 'T04', 'AC19'],
    inputs: prerequisiteInputs({
      policy: { lowestPassingLetterGrade: LetterGrade.C },
      rule: ANY_PASSING,
      attempts: [completedAttempt({ grade: pass() })],
    }),
    expected: [EQUIVALENCE_UNDEFINED],
    prohibitedClaims: [
      mustNot(CheckState.Pass, 'must not presume a P meets a C cutoff'),
      P_NOT_FAILED,
    ],
    rationale:
      'The institution says C is its lowest passing letter. Whether a P was earned at C or better is not stated, and the policy grants no P equivalence, so the P is not presumed passing.',
    citations: [P_IS_NOT_C, CUTOFF_DECISION, 'planning/13 AC19'],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GC-PF-005',
    family: GoldenRuleFamily.PassFailEquivalence,
    title: 'A P under "any passing completion" passes when policy grants equivalence',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { lowestPassingLetterGrade: LetterGrade.C, passSatisfiesMinimumGrade: true },
      rule: ANY_PASSING,
      attempts: [completedAttempt({ grade: pass() })],
    }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [P_NOT_FAILED],
    rationale:
      'The policy explicitly lets a P satisfy a minimum grade, so it meets the C cutoff as well.',
    citations: [P_IS_NOT_C, CUTOFF_DECISION, 'GC-PF-002 (equivalence against a C minimum)'],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GC-PF-006',
    family: GoldenRuleFamily.PassFailEquivalence,
    title: 'A letter cutoff does not define P equivalence against a C minimum',
    requirementIds: ['FR-06', 'T04', 'AC19'],
    inputs: prerequisiteInputs({
      policy: { lowestPassingLetterGrade: LetterGrade.D },
      attempts: [completedAttempt({ grade: pass() })],
    }),
    expected: [EQUIVALENCE_UNDEFINED],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, P_NOT_FAILED],
    rationale:
      'The cutoff says which letters pass a course; it says nothing about whether a P equals a C. With equivalence undefined, the P against a C minimum stays UNKNOWN (AC19).',
    citations: ['planning/13 AC19', P_IS_NOT_C, CUTOFF_DECISION],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GC-CUT-005',
    family: GoldenRuleFamily.PassingCutoff,
    title: 'A pass/fail F fails "any passing completion" whatever the cutoff',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { lowestPassingLetterGrade: LetterGrade.D },
      rule: ANY_PASSING,
      attempts: [completedAttempt({ grade: fail() })],
    }),
    expected: [prerequisiteCheck(CheckState.Fail, ReasonCode.MinGradeNotMet)],
    prohibitedClaims: [NOT_ELIGIBLE],
    rationale: 'A failing grade is never a passing completion, in either grade scheme.',
    citations: ['issue #71 (tech-lead: F never passes)', CUTOFF_DECISION],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GC-CUT-006',
    family: GoldenRuleFamily.PassingCutoff,
    title: 'A D at the D cutoff still fails a C minimum',
    requirementIds: ['FR-06', 'T04', 'AC01'],
    inputs: prerequisiteInputs({
      policy: { lowestPassingLetterGrade: LetterGrade.D },
      attempts: [completedAttempt({ grade: letter('D') })],
    }),
    expected: [prerequisiteCheck(CheckState.Fail, ReasonCode.MinGradeNotMet)],
    prohibitedClaims: [NOT_ELIGIBLE],
    rationale:
      'The cutoff applies only when the rule states no minimum. This rule requires C, and a D is below it even though D passes the course.',
    citations: ['planning/13 AC01', CUTOFF_DECISION],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
];
