/**
 * @file Frozen holdout cases (v0.3) for passing cutoffs, unranked grades, in-progress and
 *   incomplete attempts, and equivalent courses. Kept out of engine development; see README.md in
 *   this folder before reading further.
 * @module @caa/tests/golden/holdout/holdout-grade-families
 * @requirement FR-06
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckState, LetterGrade, ReasonCode, RepeatPolicy } from '@caa/domain';
import {
  buildPrerequisiteRule,
  completedAttempt,
  course,
  courseLeaf,
  type GoldenCase,
  GoldenRuleFamily,
  incompleteAttempt,
  inProgressAttempt,
  letter,
  mustNot,
  NEVER_PASS_WHEN_UNKNOWN,
  prerequisiteCase,
  prerequisiteCheck,
  prerequisiteInputs,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

/** Date the v0.3 holdout cases were adjudicated (#226). */
export const HOLDOUT_V03_ADJUDICATED_ON = '2026-09-29';

const { math101, math111 } = SYNTHETIC_COURSES;
const ANY_PASSING = buildPrerequisiteRule({ expression: course(math101.id) });
const CUTOFF = 'issue #69 (tech-lead decision: lowestPassingLetterGrade contract, inclusive)';
const ELIGIBILITY = 'planning/08 §Eligibility semantics';
const EQUIVALENCY = 'planning/08 §Candidate formation and allocation (stable equivalency groups)';
const NOT_ELIGIBLE = mustNot(CheckState.Pass, 'must not claim the prerequisite is met');
const NOT_BLOCKED = mustNot(CheckState.Fail, 'must not block a student who met the rule');
const NOT_PRESUMED_FAILING = mustNot(CheckState.Fail, 'must not presume the grade fails');

/** Holdout cases for grade-related families that had no holdout case before v0.3. */
export const HOLDOUT_GRADE_FAMILY_CASES: readonly GoldenCase[] = [
  prerequisiteCase({
    id: 'GH-CUT-001',
    family: GoldenRuleFamily.PassingCutoff,
    title: 'A D above a D- cutoff passes "any passing completion"',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { lowestPassingLetterGrade: LetterGrade.DMinus },
      rule: ANY_PASSING,
      attempts: [completedAttempt({ grade: letter('D') })],
    }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [NOT_BLOCKED],
    rationale: 'The policy names D- as the lowest passing letter, and D ranks above D-.',
    citations: [CUTOFF, ELIGIBILITY],
    adjudicatedOn: HOLDOUT_V03_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GH-CUT-002',
    family: GoldenRuleFamily.PassingCutoff,
    title: 'A C- one step below a C cutoff fails "any passing completion"',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { lowestPassingLetterGrade: LetterGrade.C },
      rule: ANY_PASSING,
      attempts: [completedAttempt({ grade: letter('C-') })],
    }),
    expected: [prerequisiteCheck(CheckState.Fail, ReasonCode.MinGradeNotMet)],
    prohibitedClaims: [NOT_ELIGIBLE],
    rationale: 'C- ranks just below the C cutoff, so it is not a passing completion.',
    citations: [CUTOFF, ELIGIBILITY],
    adjudicatedOn: HOLDOUT_V03_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GH-UNR-001',
    family: GoldenRuleFamily.UnrankedGrade,
    title: 'A B- the institution does not rank is unknown against a C minimum',
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
      attempts: [completedAttempt({ grade: letter('B-') })],
    }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.GradeNotRanked)],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_PRESUMED_FAILING],
    rationale:
      'The policy order has no B-, and the engine has no built-in scale, so B- cannot be compared with C even though it looks higher.',
    citations: ['issue #54 (a letter missing from the order gives UNKNOWN)', ELIGIBILITY],
    adjudicatedOn: HOLDOUT_V03_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GH-IP-001',
    family: GoldenRuleFamily.InProgress,
    title: 'An in-progress course against a B minimum is conditional on earning B',
    requirementIds: ['FR-06', 'T04', 'AC02'],
    inputs: prerequisiteInputs({
      policy: { allowsInProgressPrerequisites: true },
      rule: buildPrerequisiteRule({ expression: course(math101.id, letter('B')) }),
      attempts: [inProgressAttempt()],
    }),
    expected: [
      prerequisiteCheck(CheckState.Conditional, ReasonCode.InProgressMinGrade, {
        decisiveLeaves: [
          courseLeaf({
            path: [],
            courseId: math101.id,
            requiredGrade: letter('B'),
            attemptSeeds: [1],
            reasonCode: ReasonCode.InProgressMinGrade,
          }),
        ],
      }),
    ],
    prohibitedClaims: [mustNot(CheckState.Pass, 'must not claim unconditional eligibility')],
    rationale:
      'Policy permits planned progression, so the check is conditional on the stated minimum, B, which the evidence names.',
    citations: [
      'planning/13 AC02',
      ELIGIBILITY,
      'planning/08 evidence contract example (IN_PROGRESS_MIN_GRADE with required_grade)',
    ],
    adjudicatedOn: HOLDOUT_V03_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GH-INC-001',
    family: GoldenRuleFamily.IncompleteAttempt,
    title: 'A lone incomplete attempt is unknown, not failed',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({ attempts: [incompleteAttempt({ termCode: '2026SP' })] }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.IncompleteAttempt)],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Fail, 'must not settle a deferred grade as a failure'),
    ],
    rationale:
      'The only attempt has a deferred grade; until it is recorded, whether it meets C is unknown.',
    citations: [
      'PR #76 (tech-lead: an INCOMPLETE attempt → UNKNOWN INCOMPLETE_ATTEMPT)',
      'planning/08 §Authority and result semantics',
    ],
    adjudicatedOn: HOLDOUT_V03_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GH-EQV-001',
    family: GoldenRuleFamily.Equivalency,
    title: 'A D in an equivalent course fails a C minimum',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      attempts: [completedAttempt({ courseId: math111.id, grade: letter('D') })],
    }),
    expected: [prerequisiteCheck(CheckState.Fail, ReasonCode.MinGradeNotMet)],
    prohibitedClaims: [NOT_ELIGIBLE],
    rationale:
      'DEMO-MATH 111 shares equivalency group 1 with DEMO-MATH 101, so its attempt counts, and a D is below C.',
    citations: [EQUIVALENCY, 'issue #54 (groups by equivalency group)'],
    adjudicatedOn: HOLDOUT_V03_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GH-EQV-002',
    family: GoldenRuleFamily.Equivalency,
    title: 'HIGHEST_GRADE takes the better grade across two equivalents',
    requirementIds: ['FR-06', 'T04', 'AC04'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.HighestGrade },
      attempts: [
        completedAttempt({ courseId: math111.id, grade: letter('B'), termCode: '2025FA' }, 1),
        completedAttempt({ grade: letter('D'), termCode: '2026SP' }, 2),
      ],
    }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [NOT_BLOCKED],
    rationale:
      'The two aliases are repeats of one course; under HIGHEST_GRADE the earlier DEMO-MATH 111 B counts, not the later D.',
    citations: [EQUIVALENCY, 'planning/13 AC04', 'planning/08 §Eligibility semantics (repeats)'],
    adjudicatedOn: HOLDOUT_V03_ADJUDICATED_ON,
  }),
];
