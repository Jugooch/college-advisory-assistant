/**
 * @file Golden cases: the policy's passing cutoff combined with pass/fail grades and with a
 *   minimum grade. A letter cutoff says only which letters pass: it never raises "any passing
 *   completion" for a P (GR-01), never defines P equivalence, and never lowers a minimum.
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
const GR_01 =
  'planning/13 ruling GR-01 (#183: a P meets a rule with no minimum; P equivalence applies only to a letter minimum)';
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
    title: 'A P meets "any passing completion" whatever the letter cutoff',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { lowestPassingLetterGrade: LetterGrade.C },
      rule: ANY_PASSING,
      attempts: [completedAttempt({ grade: pass() })],
    }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [P_NOT_FAILED],
    rationale:
      'A P is a passing completion in its own scheme. The C cutoff says which letters pass; it does not turn "any passing completion" into "C or better". The rule sets no minimum, so there is no C for P equivalence to be measured against (GR-01).',
    citations: [GR_01, P_IS_NOT_C, CUTOFF_DECISION],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GC-PF-005',
    family: GoldenRuleFamily.PassFailEquivalence,
    title: 'P equivalence plays no part when the rule sets no minimum',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { lowestPassingLetterGrade: LetterGrade.C, passSatisfiesMinimumGrade: true },
      rule: ANY_PASSING,
      attempts: [completedAttempt({ grade: pass() })],
    }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [P_NOT_FAILED],
    rationale:
      'The P passes because it is a passing completion (GR-01), as in GC-PF-004. The equivalence switch applies only when the rule sets a letter minimum, so granting it changes nothing here.',
    citations: [GR_01, CUTOFF_DECISION, 'GC-PF-004 (the same P, equivalence undefined)'],
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
      'The cutoff says which letters pass a course; it says nothing about whether a P equals a C. The rule sets a C minimum and equivalence is undefined, so the P stays UNKNOWN (AC19). Contrast GC-PF-004, where the rule sets no minimum.',
    citations: ['planning/13 AC19', GR_01, P_IS_NOT_C, CUTOFF_DECISION],
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
