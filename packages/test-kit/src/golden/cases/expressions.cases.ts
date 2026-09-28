/**
 * @file Golden cases: nested AND/OR prerequisite expressions with UNKNOWN propagation, and
 *   unsupported rule text.
 * @module @caa/test-kit/golden/cases/expressions
 * @requirement FR-06
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckState, PrerequisiteExpressionType, ReasonCode } from '@caa/domain';

import {
  completedAttempt,
  inProgressAttempt,
  pendingTransferAttempt,
} from '../../builders/course-attempt.builder';
import { letter } from '../../builders/grade.builder';
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
import {
  courseLeaf,
  mustNot,
  NEVER_PASS_WHEN_UNKNOWN,
  prerequisiteCheck,
} from '../golden-expectations';
import { prerequisiteInputs } from '../golden-inputs';
import { GoldenRuleFamily } from '../golden-rule-family';

const MATH101_C = course(SYNTHETIC_COURSES.math101.id, letter('C'));
const PHYS201_C = course(SYNTHETIC_COURSES.phys201.id, letter('C'));
const PHYS = SYNTHETIC_COURSES.phys201.id;
const THREE_VALUED = 'issue #55 (ALL/ANY three-valued truth tables)';
const STRUCTURE = 'planning/08 §Eligibility semantics (AND/OR retain structure)';
const NOT_SETTLED_FAIL = mustNot(
  CheckState.Fail,
  'must not fail an OR while an alternative is undecided',
);

/**
 * Wraps an expression in the default rule (DEMO-MATH 102, `demo-rule-0001`).
 *
 * @param expression - The rule's expression.
 * @returns The rule.
 */
function ruleOf(expression: ReturnType<typeof course>): ReturnType<typeof buildPrerequisiteRule> {
  return buildPrerequisiteRule({ expression });
}

/** AND/OR and unsupported-rule cases. */
export const EXPRESSION_CASES: readonly GoldenCase[] = [
  prerequisiteCase({
    id: 'GC-EXP-001',
    family: GoldenRuleFamily.AndOrExpression,
    title: 'OR of a failed and a pending alternative is unknown',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      rule: ruleOf(any(MATH101_C, PHYS201_C)),
      attempts: [
        completedAttempt({ grade: letter('D') }, 1),
        pendingTransferAttempt({ courseId: PHYS }, 2),
      ],
    }),
    expected: [
      prerequisiteCheck(CheckState.Unknown, ReasonCode.PendingTransfer, {
        decisiveLeaves: [
          courseLeaf({
            path: [1],
            courseId: PHYS,
            requiredGrade: letter('C'),
            attemptSeeds: [2],
            reasonCode: ReasonCode.PendingTransfer,
          }),
        ],
      }),
    ],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_SETTLED_FAIL],
    rationale:
      'OR is not an ordered list: the pending alternative might still satisfy it, so the OR is UNKNOWN, not FAIL.',
    citations: [THREE_VALUED, STRUCTURE, 'planning/13 AC03'],
  }),
  prerequisiteCase({
    id: 'GC-EXP-002',
    family: GoldenRuleFamily.AndOrExpression,
    title: 'AND with one missing course fails on that course',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      rule: ruleOf(all(MATH101_C, PHYS201_C)),
      attempts: [completedAttempt()],
    }),
    expected: [
      prerequisiteCheck(CheckState.Fail, ReasonCode.NoQualifyingAttempt, {
        decisiveLeaves: [
          courseLeaf({
            path: [1],
            courseId: PHYS,
            requiredGrade: letter('C'),
            attemptSeeds: [],
            reasonCode: ReasonCode.NoQualifyingAttempt,
          }),
        ],
      }),
    ],
    prohibitedClaims: [mustNot(CheckState.Pass, 'must not pass an AND with an unmet course')],
    rationale: 'Every AND child must be satisfied; DEMO-PHYS 201 was never attempted.',
    citations: [THREE_VALUED, STRUCTURE],
  }),
  prerequisiteCase({
    id: 'GC-EXP-003',
    family: GoldenRuleFamily.AndOrExpression,
    title: 'UNKNOWN propagates from a nested OR through an AND',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      rule: ruleOf(all(any(MATH101_C, unsupported('Instructor consent')), PHYS201_C)),
      attempts: [
        completedAttempt({ grade: letter('D') }, 1),
        completedAttempt({ courseId: PHYS }, 2),
      ],
    }),
    expected: [
      prerequisiteCheck(CheckState.Unknown, ReasonCode.UnsupportedRule, {
        decisiveLeaves: [
          {
            type: PrerequisiteExpressionType.Unsupported,
            path: [0, 1],
            sourceText: 'Instructor consent',
            reasonCode: ReasonCode.UnsupportedRule,
          },
        ],
      }),
    ],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_SETTLED_FAIL],
    rationale:
      'D fails the first OR branch, consent is unrepresentable (UNKNOWN), so the OR and then the AND with a PASS are UNKNOWN.',
    citations: [
      THREE_VALUED,
      'planning/08 §Authority and result semantics (UNKNOWN is never PASS)',
    ],
  }),
  prerequisiteCase({
    id: 'GC-EXP-004',
    family: GoldenRuleFamily.AndOrExpression,
    title: 'A failed AND child outranks an unknown sibling',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      rule: ruleOf(all(MATH101_C, PHYS201_C)),
      attempts: [
        pendingTransferAttempt({}, 1),
        completedAttempt({ courseId: PHYS, grade: letter('D') }, 2),
      ],
    }),
    expected: [prerequisiteCheck(CheckState.Fail, ReasonCode.MinGradeNotMet)],
    prohibitedClaims: [mustNot(CheckState.Pass, 'must not pass an AND with a failed course')],
    rationale:
      'Whatever the pending transfer becomes, the D in DEMO-PHYS 201 already violates the AND.',
    citations: [THREE_VALUED, STRUCTURE],
  }),
  prerequisiteCase({
    id: 'GC-EXP-005',
    family: GoldenRuleFamily.AndOrExpression,
    title: 'A passed OR alternative outranks an unsupported one',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      rule: ruleOf(any(MATH101_C, unsupported('Department approval'))),
      attempts: [completedAttempt()],
    }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [
      mustNot(CheckState.Unknown, 'must not refer a student who met one OR alternative'),
    ],
    rationale:
      'The B in DEMO-MATH 101 satisfies the OR; the unrepresentable alternative is not needed.',
    citations: [THREE_VALUED, STRUCTURE],
  }),
  prerequisiteCase({
    id: 'GC-EXP-006',
    family: GoldenRuleFamily.AndOrExpression,
    title: 'OR of an in-progress and a pending alternative is conditional',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { allowsInProgressPrerequisites: true },
      rule: ruleOf(any(MATH101_C, PHYS201_C)),
      attempts: [inProgressAttempt({}, 1), pendingTransferAttempt({ courseId: PHYS }, 2)],
    }),
    expected: [prerequisiteCheck(CheckState.Conditional, ReasonCode.InProgressMinGrade)],
    prohibitedClaims: [mustNot(CheckState.Pass, 'must not claim unconditional eligibility')],
    rationale:
      'Earning C in DEMO-MATH 101 would satisfy the OR on its own, which is a sufficient stated condition.',
    citations: [THREE_VALUED, 'planning/08 §Eligibility semantics'],
  }),
  prerequisiteCase({
    id: 'GC-UNS-001',
    family: GoldenRuleFamily.UnsupportedRule,
    title: 'An unsupported rule is unknown and keeps its source text',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      rule: ruleOf(unsupported('Junior standing or consent of instructor')),
      attempts: [completedAttempt()],
    }),
    expected: [
      prerequisiteCheck(CheckState.Unknown, ReasonCode.UnsupportedRule, {
        decisiveLeaves: [
          {
            type: PrerequisiteExpressionType.Unsupported,
            path: [],
            sourceText: 'Junior standing or consent of instructor',
            reasonCode: ReasonCode.UnsupportedRule,
          },
        ],
      }),
    ],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Fail, 'must not block on a rule the app cannot read'),
    ],
    rationale:
      'Standing and consent are unsupported; the planner refers instead of inferring them.',
    citations: [
      'issue #55 (UNSUPPORTED → UNKNOWN UNSUPPORTED_RULE)',
      'planning/08 §Eligibility semantics (referral)',
    ],
  }),
];
