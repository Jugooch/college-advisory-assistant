/**
 * @file Golden cases: repeated attempts ordered by the tenant's term calendar, never by the text
 *   of the term code, including terms the calendar doesn't place.
 * @module @caa/test-kit/golden/cases/term-order
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckState, type Grade, ReasonCode, RepeatPolicy, type TermCalendar } from '@caa/domain';

import { completedAttempt } from '../../builders/course-attempt.builder';
import { letter } from '../../builders/grade.builder';
import { buildTermCalendar } from '../../builders/term.builder';
import { SYNTHETIC_TENANTS } from '../../fixtures/synthetic-tenants';
import { type GoldenCase } from '../golden-case.schema';
import { prerequisiteCase } from '../golden-case-factories';
import { mustNot, NEVER_PASS_WHEN_UNKNOWN, prerequisiteCheck } from '../golden-expectations';
import { prerequisiteInputs, S3_ADJUDICATED_ON } from '../golden-inputs';
import { GoldenRuleFamily } from '../golden-rule-family';

const TERMS =
  'planning/09 §Canonical entities (Term: tenant-specific IDs; ordered by the tenant calendar)';
const REPEATS = 'planning/08 §Eligibility semantics (repeated attempts use approved semantics)';
const SEQUENCE = 'packages/domain Term (ordered by sequence, never by termCode text)';
const PR_124 = 'PR #124 (term order from the TermCalendar)';
const UNDETERMINED = 'packages/domain ReasonCode (REPEAT_ORDER_UNDETERMINED: terms missing)';
const NOT_ELIGIBLE = mustNot(CheckState.Pass, 'must not claim the prerequisite is met');
const NOT_BLOCKED = mustNot(CheckState.Fail, 'must not block on an attempt that no longer counts');
const NOT_GUESSED_FAIL = mustNot(CheckState.Fail, 'must not guess which repeat is most recent');
const MOST_RECENT = { repeatPolicy: RepeatPolicy.MostRecent };

/**
 * Two completed DEMO-MATH 101 attempts, seed 1 and seed 2.
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

/**
 * A two-term calendar with the given sequences: `2026SP`, then `2026FA`.
 *
 * @param spring - Sequence of 2026SP.
 * @param fall - Sequence of 2026FA; larger than `spring`.
 * @returns The calendar.
 */
function springThenFall(spring: number, fall: number): TermCalendar {
  return buildTermCalendar([
    { termCode: '2026SP', startsOn: '2026-01-12', endsOn: '2026-05-08', sequence: spring },
    { termCode: '2026FA', startsOn: '2026-08-24', endsOn: '2026-12-18', sequence: fall },
  ]);
}

/** Term-order cases. Rule: DEMO-MATH 102 needs DEMO-MATH 101 ≥ C, repeats under MOST_RECENT. */
export const TERM_ORDER_CASES: readonly GoldenCase[] = [
  prerequisiteCase({
    id: 'GC-TERM-001',
    family: GoldenRuleFamily.TermOrder,
    title: 'MOST_RECENT follows the calendar where the code text sorts the other way',
    requirementIds: ['FR-06', 'NFR-01', 'T04'],
    inputs: prerequisiteInputs({
      policy: MOST_RECENT,
      attempts: twoAttempts([letter('D'), '2026SP'], [letter('B'), '2026FA']),
    }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [NOT_BLOCKED],
    rationale:
      "The calendar puts 2026FA (sequence 3) after 2026SP (sequence 2), so the B counts. As text, '2026FA' sorts before '2026SP', which would wrongly count the D.",
    citations: [SEQUENCE, TERMS, REPEATS, PR_124],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GC-TERM-002',
    family: GoldenRuleFamily.TermOrder,
    title: 'A term missing from the calendar leaves MOST_RECENT undetermined',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: MOST_RECENT,
      attempts: twoAttempts([letter('D'), '2025FA'], [letter('B'), '2026SU']),
    }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.RepeatOrderUndetermined)],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_GUESSED_FAIL],
    rationale:
      'The calendar has no 2026SU, so whether the B is more recent than the D is unknown; its order is never guessed from the code.',
    citations: [
      UNDETERMINED,
      TERMS,
      'planning/08 §Authority and result semantics (missing data → UNKNOWN)',
    ],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GC-TERM-003',
    family: GoldenRuleFamily.TermOrder,
    title: "Another tenant's calendar can't order this tenant's attempts",
    requirementIds: ['FR-06', 'T01', 'T04'],
    inputs: prerequisiteInputs({
      policy: MOST_RECENT,
      attempts: twoAttempts([letter('D'), '2025FA'], [letter('B'), '2026SP']),
      termCalendar: buildTermCalendar([
        { tenantId: SYNTHETIC_TENANTS.b.id, termCode: '2025FA' },
        {
          tenantId: SYNTHETIC_TENANTS.b.id,
          termCode: '2026SP',
          startsOn: '2026-01-12',
          endsOn: '2026-05-08',
        },
      ]),
    }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.RepeatOrderUndetermined)],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_GUESSED_FAIL],
    rationale:
      "Tenant B's calendar lists the same codes, but term codes are tenant-specific; tenant A supplied no calendar, so the order is unknown.",
    citations: [
      TERMS,
      'planning/09 §Canonical entities (composite rules prevent cross-tenant references)',
      UNDETERMINED,
    ],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GC-TERM-004',
    family: GoldenRuleFamily.TermOrder,
    title: 'Negative sequences still order the attempts',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: MOST_RECENT,
      attempts: twoAttempts([letter('D'), '2026SP'], [letter('B'), '2026FA']),
      termCalendar: springThenFall(-20, -10),
    }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [NOT_BLOCKED],
    rationale: '-10 is later than -20, so the 2026FA B is the most recent attempt and meets C.',
    citations: [SEQUENCE, 'packages/domain Term.sequence (any integer; gaps allowed)', PR_124],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GC-TERM-005',
    family: GoldenRuleFamily.TermOrder,
    title: 'A term at sequence zero is later than one at minus one',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: MOST_RECENT,
      attempts: twoAttempts([letter('B'), '2026SP'], [letter('D'), '2026FA']),
      termCalendar: springThenFall(-1, 0),
    }),
    expected: [prerequisiteCheck(CheckState.Fail, ReasonCode.MinGradeNotMet)],
    prohibitedClaims: [NOT_ELIGIBLE],
    rationale:
      'Sequence 0 is a real position, later than -1, so the 2026FA D counts under MOST_RECENT and is below C.',
    citations: [SEQUENCE, REPEATS, PR_124],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GC-TERM-006',
    family: GoldenRuleFamily.TermOrder,
    title: 'An empty calendar leaves MOST_RECENT undetermined',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: MOST_RECENT,
      attempts: twoAttempts([letter('D'), '2025FA'], [letter('B'), '2026SP']),
      termCalendar: buildTermCalendar([]),
    }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.RepeatOrderUndetermined)],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_GUESSED_FAIL],
    rationale:
      'The tenant supplied no terms, so no attempt can be placed and "most recent" is unknown.',
    citations: [UNDETERMINED, 'packages/domain TermCalendar (empty means no terms were supplied)'],
    adjudicatedOn: S3_ADJUDICATED_ON,
  }),
];
