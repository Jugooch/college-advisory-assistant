/**
 * @file Golden cases: the prerequisite leaf on a course repeatable for credit (ADR-0012 §2).
 *   Credits are hundredths, and terms are ordered by the counting calendar's `sequence`.
 * @module @caa/test-kit/golden/cases/repeat-credit-prerequisite-leaf
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/adr/0012-explicit-no-prerequisite-rules-and-repeat-for-credit-counting.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckState, ReasonCode, RepeatPolicy } from '@caa/domain';

import { completedAttempt } from '../../builders/course-attempt.builder';
import { letter } from '../../builders/grade.builder';
import {
  buildPrerequisiteRule,
  course as courseLeaf,
} from '../../builders/prerequisite-rule.builder';
import { type GoldenCase } from '../golden-case.schema';
import { prerequisiteCase } from '../golden-case-factories';
import { COUNTING_REVIEW } from '../golden-counting-factories';
import { ENSEMBLE as ensemble } from '../golden-counting-fixtures';
import { mustNot, NEVER_PASS_WHEN_UNKNOWN, prerequisiteCheck } from '../golden-expectations';
import { GOLDEN_CATALOG, prerequisiteInputs } from '../golden-inputs';
import { GoldenRuleFamily } from '../golden-rule-family';

const ADR = 'docs/adr/0012 §2 (repeat-for-credit counting)';

/** The rule under test: DEMO-MATH 102 needs the repeatable ensemble course with at least a C. */
const REPEATABLE_LEAF = buildPrerequisiteRule({
  expression: courseLeaf(ensemble.id, letter('C')),
});
/** The golden catalog plus the repeatable course. */
const LEAF_CATALOG = [...GOLDEN_CATALOG, ensemble];
/** Why every case here ignores the repeat policy. */
const LEAF_RATIONALE =
  'The repeat policy is not consulted for a repeatable course: attempts do not replace each other, so one attempt that meets the minimum is enough.';
const NOT_BLOCKED = mustNot(CheckState.Fail, 'must not block a student with a counted B');

/** Prerequisite cases on a leaf whose course is repeatable for credit. */
export const REPEAT_CREDIT_PREREQUISITE_CASES: readonly GoldenCase[] = [
  prerequisiteCase({
    id: 'GC-REP-015',
    family: GoldenRuleFamily.Repeat,
    title: 'A repeatable leaf with attempts D then B passes without a repeat policy',
    requirementIds: ['FR-06', 'AC04'],
    inputs: prerequisiteInputs({
      rule: REPEATABLE_LEAF,
      courses: LEAF_CATALOG,
      attempts: [
        completedAttempt({ courseId: ensemble.id, grade: letter('D'), termCode: '2025FA' }, 1),
        completedAttempt({ courseId: ensemble.id, grade: letter('B'), termCode: '2026SP' }, 2),
      ],
    }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [NOT_BLOCKED, mustNot(CheckState.Unknown, 'must not need a repeat policy')],
    rationale: LEAF_RATIONALE,
    citations: [ADR],
    adjudicatedOn: COUNTING_REVIEW.adjudicatedOn,
  }),
  prerequisiteCase({
    id: 'GC-REP-016',
    family: GoldenRuleFamily.Repeat,
    title: 'A repeatable leaf with attempts B then D passes: any counted attempt suffices',
    requirementIds: ['FR-06', 'AC04'],
    inputs: prerequisiteInputs({
      rule: REPEATABLE_LEAF,
      courses: LEAF_CATALOG,
      attempts: [
        completedAttempt({ courseId: ensemble.id, grade: letter('B'), termCode: '2025FA' }, 1),
        completedAttempt({ courseId: ensemble.id, grade: letter('D'), termCode: '2026SP' }, 2),
      ],
      policy: { repeatPolicy: RepeatPolicy.MostRecent },
    }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [NOT_BLOCKED],
    rationale: `${LEAF_RATIONALE} MOST_RECENT would pick the D and fail, but it is not consulted.`,
    citations: [ADR],
    adjudicatedOn: COUNTING_REVIEW.adjudicatedOn,
  }),
  prerequisiteCase({
    id: 'GC-REP-017',
    family: GoldenRuleFamily.Repeat,
    title: 'A repeatable leaf with attempts D and D fails the minimum grade',
    requirementIds: ['FR-06', 'AC04'],
    inputs: prerequisiteInputs({
      rule: REPEATABLE_LEAF,
      courses: LEAF_CATALOG,
      attempts: [
        completedAttempt({ courseId: ensemble.id, grade: letter('D'), termCode: '2025FA' }, 1),
        completedAttempt({ courseId: ensemble.id, grade: letter('D'), termCode: '2026SP' }, 2),
      ],
    }),
    expected: [prerequisiteCheck(CheckState.Fail, ReasonCode.MinGradeNotMet)],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN],
    rationale:
      'No counted attempt meets C, and every outcome is known, so the leaf fails rather than being unknown.',
    citations: [ADR],
    adjudicatedOn: COUNTING_REVIEW.adjudicatedOn,
  }),
];
