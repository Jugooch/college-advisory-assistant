/**
 * @file Golden cases: repeat-for-credit groups that are not repeatable, conflict, or can't be ordered (ADR-0012 §2). Credits are hundredths, and terms are ordered by the
 *   counting calendar's `sequence`.
 * @module @caa/test-kit/golden/cases/repeat-credit-undetermined
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/adr/0012-explicit-no-prerequisite-rules-and-repeat-for-credit-counting.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CountingState, ReasonCode, RepeatPolicy } from '@caa/domain';

import { buildCourse } from '../../builders/course.builder';
import { syntheticId } from '../../fixtures/synthetic-id';
import {
  counted,
  countingCase,
  countingInputs,
  type GoldenCountingCase,
  undetermined,
} from '../golden-counting-case.schema';
import {
  attemptOf,
  ENSEMBLE as ensemble,
  inTerms,
  notMore,
  repeatable,
  UNLISTED_TERM,
} from '../golden-counting-fixtures';

const ADR = 'docs/adr/0012 §2 (repeat-for-credit counting)';
const AC04 = 'planning/13 AC04 (duplicate credit only when policy explicitly permits it)';
const NEVER_UNKNOWN = 'must not leave settled credit unknown';

const CAP_TWO_ATTEMPTS = repeatable(31, [2, null]);
const MIXED_FIRST = repeatable(35, [4, 400], 7);
const MIXED_SECOND = repeatable(36, [2, 600], 7);
const MIXED_NOT_REPEATABLE = buildCourse(
  { equivalencyGroupId: syntheticId('equivalencyGroup', 7) },
  37,
);
const NOT_REPEATABLE = buildCourse({}, 38);

export /**
 *
 */
const REPEAT_CREDIT_UNDETERMINED_CASES: readonly GoldenCountingCase[] = [
  countingCase({
    id: 'GC-RCR-012',
    title: 'A course not repeatable for credit counts one attempt: MOST_RECENT earns 3.00',
    requirementIds: ['FR-06', 'AC04'],
    inputs: countingInputs({
      courses: [NOT_REPEATABLE],
      attempts: inTerms(NOT_REPEATABLE, 2, 300),
      repeatPolicy: RepeatPolicy.MostRecent,
    }),
    expected: counted(300),
    prohibitedClaims: [notMore(600)],
    rationale: 'repeatableForCredit null keeps the repeat policy: one counting attempt, 3.00.',
    citations: [ADR, AC04],
  }),
  countingCase({
    id: 'GC-RCR-013',
    title: 'A course not repeatable for credit with no repeat policy is undetermined',
    requirementIds: ['FR-06', 'AC04'],
    inputs: countingInputs({
      courses: [NOT_REPEATABLE],
      attempts: inTerms(NOT_REPEATABLE, 2, 300),
    }),
    expected: undetermined(ReasonCode.RepeatPolicyUndefined),
    prohibitedClaims: [
      notMore(600),
      { earnedCreditsHundredths: 300, claim: 'must not guess which attempt counts' },
    ],
    rationale: 'repeatableForCredit null and no repeat policy: which repeat counts is not stated.',
    citations: [ADR, AC04],
  }),
  countingCase({
    id: 'GC-RCR-014',
    title: 'Equivalents with different repeat caps are undetermined, not counted',
    requirementIds: ['FR-06', 'AC04'],
    inputs: countingInputs({
      courses: [MIXED_FIRST, MIXED_SECOND],
      attempts: [
        attemptOf(MIXED_FIRST, 1, ['2025FA', 300]),
        attemptOf(MIXED_SECOND, 2, ['2026SP', 300]),
      ],
      repeatPolicy: RepeatPolicy.MostRecent,
    }),
    expected: undetermined(ReasonCode.RepeatPolicyUndefined),
    prohibitedClaims: [
      { state: CountingState.Counted, claim: 'must not pick a cap when the catalog conflicts' },
      notMore(600),
    ],
    rationale:
      'The group has two countable attempts and its courses state different repeatableForCredit values: the catalog conflicts, so nothing is guessed.',
    citations: [ADR],
  }),
  countingCase({
    id: 'GC-RCR-015',
    title: 'Equivalents where one is not repeatable for credit are undetermined',
    requirementIds: ['FR-06', 'AC04'],
    inputs: countingInputs({
      courses: [MIXED_FIRST, MIXED_NOT_REPEATABLE],
      attempts: [
        attemptOf(MIXED_FIRST, 1, ['2025FA', 300]),
        attemptOf(MIXED_NOT_REPEATABLE, 2, ['2026SP', 300]),
      ],
      repeatPolicy: RepeatPolicy.MostRecent,
    }),
    expected: undetermined(ReasonCode.RepeatPolicyUndefined),
    prohibitedClaims: [
      { state: CountingState.Counted, claim: 'must not treat the group as repeatable or not' },
    ],
    rationale:
      'A group is repeatable only when every course states the same non-null value; here one states null.',
    citations: [ADR],
  }),
  countingCase({
    id: 'GC-RCR-016',
    title: 'A binding attempt cap cannot order two same-term attempts of different credit',
    requirementIds: ['FR-06', 'AC04'],
    inputs: countingInputs({
      courses: [CAP_TWO_ATTEMPTS],
      attempts: [
        attemptOf(CAP_TWO_ATTEMPTS, 1, ['2025FA', 100]),
        attemptOf(CAP_TWO_ATTEMPTS, 2, ['2026SP', 100]),
        attemptOf(CAP_TWO_ATTEMPTS, 3, ['2026SP', 200]),
      ],
    }),
    expected: undetermined(ReasonCode.RepeatOrderUndetermined),
    prohibitedClaims: [
      {
        state: CountingState.Counted,
        claim: 'must not choose between same-term attempts by input order',
      },
    ],
    rationale:
      'maxAttempts 2 counts the 2025FA attempt, then must choose between two 2026SP attempts of 1.00 and 2.00: which counts changes the total, and order is not an institutional fact.',
    citations: [ADR],
  }),
  countingCase({
    id: 'GC-RCR-017',
    title: 'A binding attempt cap cannot order an attempt in a term the calendar lacks',
    requirementIds: ['FR-06', 'AC04'],
    inputs: countingInputs({
      courses: [CAP_TWO_ATTEMPTS],
      attempts: [
        attemptOf(CAP_TWO_ATTEMPTS, 1, ['2026SP', 100]),
        attemptOf(CAP_TWO_ATTEMPTS, 2, ['2026FA', 100]),
        attemptOf(CAP_TWO_ATTEMPTS, 3, [UNLISTED_TERM, 100]),
      ],
    }),
    expected: undetermined(ReasonCode.RepeatOrderUndetermined),
    prohibitedClaims: [
      { state: CountingState.Counted, claim: 'must not guess where an unlisted term falls' },
    ],
    rationale:
      'The calendar has no 2029SP, so its position is unknown and the cut can not be placed.',
    citations: [ADR],
  }),
  countingCase({
    id: 'GC-RCR-018',
    title: 'Same-term attempts of equal credit settle by ID: the total is unchanged',
    requirementIds: ['FR-06', 'AC04'],
    inputs: countingInputs({
      courses: [CAP_TWO_ATTEMPTS],
      attempts: [
        attemptOf(CAP_TWO_ATTEMPTS, 1, ['2025FA', 100]),
        attemptOf(CAP_TWO_ATTEMPTS, 2, ['2026SP', 100]),
        attemptOf(CAP_TWO_ATTEMPTS, 3, ['2026SP', 100]),
      ],
    }),
    expected: counted(200),
    prohibitedClaims: [
      {
        state: CountingState.Undetermined,
        claim: 'must not refuse a tie that never changes the total',
      },
      notMore(300),
    ],
    rationale:
      'maxAttempts 2 counts the 2025FA attempt and one of two equal 2026SP attempts: whichever, the total is 2.00. The tie breaks by attempt ID.',
    citations: [ADR],
  }),
  countingCase({
    id: 'GC-RCR-019',
    title: 'Order does not matter when no cap binds, even with an unlisted term',
    requirementIds: ['FR-06', 'AC04'],
    inputs: countingInputs({
      courses: [ensemble],
      attempts: [
        attemptOf(ensemble, 1, ['2026SP', 100]),
        attemptOf(ensemble, 2, [UNLISTED_TERM, 100]),
      ],
    }),
    expected: counted(200),
    prohibitedClaims: [{ state: CountingState.Undetermined, claim: NEVER_UNKNOWN }],
    rationale:
      'Two attempts under maxAttempts 4 and maxCredits 4.00: every attempt counts whatever the order.',
    citations: [ADR],
  }),
  countingCase({
    id: 'GC-RCR-020',
    title: 'A counted attempt with unknown earned credit leaves the total unknown',
    requirementIds: ['FR-06', 'AC04'],
    inputs: countingInputs({
      courses: [ensemble],
      attempts: [attemptOf(ensemble, 1, ['2025FA', 100]), attemptOf(ensemble, 2, ['2026SP', null])],
    }),
    expected: counted(null),
    prohibitedClaims: [
      { earnedCreditsHundredths: 100, claim: 'must not sum only the attempts with known credit' },
      { earnedCreditsHundredths: 0, claim: 'must not treat unknown credit as zero' },
    ],
    rationale:
      'creditsEarnedHundredths null on a counted attempt means the credit is unknown, so the total is null.',
    citations: [ADR, 'planning/08 §Eligibility semantics (UNKNOWN is never PASS)'],
  }),
];
