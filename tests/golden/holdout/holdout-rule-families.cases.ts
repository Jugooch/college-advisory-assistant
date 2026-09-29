/**
 * @file Frozen holdout cases (v0.3) for unsupported rules, catalog gaps, and repeated attempts
 *   ordered by the term calendar. Kept out of engine development; see README.md in this folder
 *   before reading further.
 * @module @caa/tests/golden/holdout/holdout-rule-families
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckState, PrerequisiteExpressionType, ReasonCode, RepeatPolicy } from '@caa/domain';
import {
  all,
  any,
  buildCourse,
  buildPrerequisiteRule,
  completedAttempt,
  course,
  type GoldenCase,
  GoldenRuleFamily,
  letter,
  mustNot,
  NEVER_PASS_WHEN_UNKNOWN,
  prerequisiteCase,
  prerequisiteCheck,
  prerequisiteInputs,
  SYNTHETIC_COURSES,
  unsupported,
} from '@caa/test-kit';

import { HOLDOUT_V03_ADJUDICATED_ON } from './holdout-grade-families.cases';

const { math101 } = SYNTHETIC_COURSES;
const MATH101_C = course(math101.id, letter('C'));
/** A course of the synthetic tenant that is left out of the catalog on purpose. */
const UNCATALOGUED = buildCourse({}, 0x998);
const TRUTH_TABLES = 'issue #55 (ALL/ANY three-valued truth tables)';
const MISSING = 'planning/08 §Authority and result semantics (missing data → UNKNOWN)';
const TERMS =
  'planning/09 §Canonical entities (Term: ordered by the tenant calendar, never by code text)';
const MOST_RECENT = { repeatPolicy: RepeatPolicy.MostRecent };
const NOT_SETTLED_FAIL = mustNot(CheckState.Fail, 'must not settle as failed on missing data');

/** Holdout cases for rule-level families that had no holdout case before v0.3. */
export const HOLDOUT_RULE_FAMILY_CASES: readonly GoldenCase[] = [
  prerequisiteCase({
    id: 'GH-UNS-001',
    family: GoldenRuleFamily.UnsupportedRule,
    title: 'A met course AND an unsupported approval is unknown',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      rule: buildPrerequisiteRule({
        expression: all(MATH101_C, unsupported('Department approval')),
      }),
      attempts: [completedAttempt()],
    }),
    expected: [
      prerequisiteCheck(CheckState.Unknown, ReasonCode.UnsupportedRule, {
        decisiveLeaves: [
          {
            type: PrerequisiteExpressionType.Unsupported,
            path: [1],
            sourceText: 'Department approval',
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
      'The B meets the course part, but the approval is unrepresentable, so the AND is UNKNOWN and the evidence names the unsupported text.',
    citations: [
      'issue #55 (UNSUPPORTED → UNKNOWN UNSUPPORTED_RULE)',
      TRUTH_TABLES,
      'planning/08 §Authority and result semantics (UNKNOWN is never PASS)',
    ],
    adjudicatedOn: HOLDOUT_V03_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GH-CAT-001',
    family: GoldenRuleFamily.CatalogGap,
    title: 'An empty catalog leaves a met-looking prerequisite unknown',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({ courses: [], attempts: [completedAttempt()] }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.CourseNotInCatalog)],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_SETTLED_FAIL],
    rationale:
      'The tenant supplied no catalog, so neither the required course nor its equivalents are known, and the B cannot be counted.',
    citations: [MISSING, 'PR #76 decision table (required course not in catalog)'],
    adjudicatedOn: HOLDOUT_V03_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GH-CAT-002',
    family: GoldenRuleFamily.CatalogGap,
    title: 'An uncatalogued alternative does not unsettle a met OR branch',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      rule: buildPrerequisiteRule({
        expression: any(course(UNCATALOGUED.id, letter('C')), MATH101_C),
      }),
      attempts: [completedAttempt()],
    }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [mustNot(CheckState.Fail, 'must not block a student who met a branch')],
    rationale:
      'The first branch is UNKNOWN because its course is not in the catalog, but the B in DEMO-MATH 101 satisfies the second, and an OR with a PASS branch is PASS. No attempt is of an uncatalogued course.',
    citations: [
      TRUTH_TABLES,
      'planning/08 §Authority and result semantics (PASS: current evidence)',
    ],
    adjudicatedOn: HOLDOUT_V03_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GH-TERM-001',
    family: GoldenRuleFamily.TermOrder,
    title: 'MOST_RECENT of three attempts counts the latest term in the calendar',
    requirementIds: ['FR-06', 'NFR-01', 'T04'],
    inputs: prerequisiteInputs({
      policy: MOST_RECENT,
      attempts: [
        completedAttempt({ grade: letter('D'), termCode: '2025FA' }, 1),
        completedAttempt({ grade: letter('B'), termCode: '2026SP' }, 2),
        completedAttempt({ grade: letter('D'), termCode: '2026FA' }, 3),
      ],
    }),
    expected: [prerequisiteCheck(CheckState.Fail, ReasonCode.MinGradeNotMet)],
    prohibitedClaims: [mustNot(CheckState.Pass, 'must not count an attempt that was replaced')],
    rationale:
      'The calendar places 2026FA (sequence 3) last, so its D is the most recent attempt and is below C; the earlier B no longer counts.',
    citations: [TERMS, 'planning/08 §Eligibility semantics (repeats use approved semantics)'],
    adjudicatedOn: HOLDOUT_V03_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GH-TERM-002',
    family: GoldenRuleFamily.TermOrder,
    title: 'An older term missing from the calendar leaves MOST_RECENT undetermined',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: MOST_RECENT,
      attempts: [
        completedAttempt({ grade: letter('D'), termCode: '2024FA' }, 1),
        completedAttempt({ grade: letter('B'), termCode: '2026SP' }, 2),
      ],
    }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.RepeatOrderUndetermined)],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Fail, 'must not guess which repeat is most recent'),
    ],
    rationale:
      'The calendar has no 2024FA, so the D cannot be placed. That it looks older from its code is never used, so the order is unknown.',
    citations: [
      TERMS,
      'packages/domain ReasonCode (REPEAT_ORDER_UNDETERMINED: terms missing)',
      MISSING,
    ],
    adjudicatedOn: HOLDOUT_V03_ADJUDICATED_ON,
  }),
];
