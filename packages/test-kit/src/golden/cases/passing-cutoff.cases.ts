/**
 * @file Golden cases: rules with no minimum grade, decided by the policy's passing cutoff, and
 *   grades the policy can't rank or compare.
 * @module @caa/test-kit/golden/cases/passing-cutoff
 * @requirement FR-06
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckState, GradeScheme, LetterGrade, ReasonCode } from '@caa/domain';

import { completedAttempt } from '../../builders/course-attempt.builder';
import { buildGrade, letter } from '../../builders/grade.builder';
import { buildPrerequisiteRule, course } from '../../builders/prerequisite-rule.builder';
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

const ANY_PASSING = buildPrerequisiteRule({ expression: course(SYNTHETIC_COURSES.math101.id) });
const CUTOFF_DECISION = 'issue #69 (tech-lead decision: lowestPassingLetterGrade contract)';
const NOT_ELIGIBLE = mustNot(CheckState.Pass, 'must not claim the prerequisite is met');
const NOT_PRESUMED_FAILING = mustNot(CheckState.Fail, 'must not presume the grade fails');

/** Passing-cutoff and unranked-grade cases. */
export const PASSING_CUTOFF_CASES: readonly GoldenCase[] = [
  prerequisiteCase({
    id: 'GC-CUT-001',
    family: GoldenRuleFamily.PassingCutoff,
    title: 'A D under "any passing completion" is unknown with no cutoff',
    requirementIds: ['FR-06', 'T04', 'AC19'],
    inputs: prerequisiteInputs({
      rule: ANY_PASSING,
      attempts: [completedAttempt({ grade: letter('D') })],
    }),
    expected: [
      prerequisiteCheck(CheckState.Unknown, ReasonCode.PassingGradeUndefined, {
        decisiveLeaves: [
          courseLeaf({
            path: [],
            courseId: SYNTHETIC_COURSES.math101.id,
            requiredGrade: null,
            attemptSeeds: [1],
            reasonCode: ReasonCode.PassingGradeUndefined,
          }),
        ],
      }),
    ],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_PRESUMED_FAILING],
    rationale:
      'Whether D passes is institutional semantics; with lowestPassingLetterGrade null it is not presumed passing.',
    citations: ['planning/13 AC19', CUTOFF_DECISION, 'planning/08 §Eligibility semantics'],
  }),
  prerequisiteCase({
    id: 'GC-CUT-002',
    family: GoldenRuleFamily.PassingCutoff,
    title: 'A D at a D cutoff passes',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { lowestPassingLetterGrade: LetterGrade.D },
      rule: ANY_PASSING,
      attempts: [completedAttempt({ grade: letter('D') })],
    }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [mustNot(CheckState.Fail, 'must not block a passing completion')],
    rationale: 'Policy says D is the lowest passing letter; the cutoff is inclusive.',
    citations: [CUTOFF_DECISION],
  }),
  prerequisiteCase({
    id: 'GC-CUT-003',
    family: GoldenRuleFamily.PassingCutoff,
    title: 'A D below a C cutoff fails',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { lowestPassingLetterGrade: LetterGrade.C },
      rule: ANY_PASSING,
      attempts: [completedAttempt({ grade: letter('D') })],
    }),
    expected: [prerequisiteCheck(CheckState.Fail, ReasonCode.MinGradeNotMet)],
    prohibitedClaims: [NOT_ELIGIBLE],
    rationale: 'Policy says C is the lowest passing letter; D is not a passing completion.',
    citations: [CUTOFF_DECISION],
  }),
  prerequisiteCase({
    id: 'GC-CUT-004',
    family: GoldenRuleFamily.PassingCutoff,
    title: 'A ranked F fails "any passing completion" even with no cutoff',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      rule: ANY_PASSING,
      attempts: [completedAttempt({ grade: letter('F') })],
    }),
    expected: [prerequisiteCheck(CheckState.Fail, ReasonCode.MinGradeNotMet)],
    prohibitedClaims: [NOT_ELIGIBLE],
    rationale:
      'A failing grade never passes because of a policy setting; a ranked F is always FAIL.',
    citations: ['issue #71 (tech-lead: F never passes)', CUTOFF_DECISION],
  }),
  prerequisiteCase({
    id: 'GC-UNR-001',
    family: GoldenRuleFamily.UnrankedGrade,
    title: 'A C+ the institution does not rank is unknown against a C minimum',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: {
        letterGradeOrder: [
          LetterGrade.A,
          LetterGrade.B,
          LetterGrade.C,
          LetterGrade.D,
          LetterGrade.F,
        ],
      },
      attempts: [completedAttempt({ grade: letter('C+') })],
    }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.GradeNotRanked)],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_PRESUMED_FAILING],
    rationale:
      'The engine has no built-in scale; a letter missing from the policy order cannot be compared.',
    citations: [
      'issue #54 (a letter missing from the order gives UNKNOWN)',
      'PR #64 (unranked letter → GRADE_NOT_RANKED)',
    ],
  }),
  prerequisiteCase({
    id: 'GC-UNR-002',
    family: GoldenRuleFamily.UnrankedGrade,
    title: 'A grade in an unknown scheme is unknown against a C minimum',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      attempts: [
        completedAttempt({ grade: buildGrade({ scheme: GradeScheme.Unknown, value: 'CR' }) }),
      ],
    }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.GradeSchemeMismatch)],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_PRESUMED_FAILING],
    rationale:
      'Grade schemes are preserved; an unrecognized scheme has no approved comparison with C.',
    citations: [
      'issue #54 (unknown scheme → GRADE_SCHEME_MISMATCH)',
      'planning/08 §Candidate formation and allocation',
    ],
  }),
];
