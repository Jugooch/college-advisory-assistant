/**
 * @file Golden cases: counting repeat-for-credit attempts within, exactly at, and over the caps (ADR-0012 §2). Credits are hundredths, and terms are ordered by the
 *   counting calendar's `sequence`.
 * @module @caa/test-kit/golden/cases/repeat-credit-caps
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/adr/0012-explicit-no-prerequisite-rules-and-repeat-for-credit-counting.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { AttemptStatus } from '@caa/domain';

import {
  completedAttempt,
  inProgressAttempt,
  pendingTransferAttempt,
} from '../../builders/course-attempt.builder';
import { letter } from '../../builders/grade.builder';
import {
  counted,
  countingCase,
  countingInputs,
  type GoldenCountingCase,
  NO_COUNTING_ATTEMPT,
} from '../golden-counting-case.schema';
import {
  attemptOf,
  ENSEMBLE as ensemble,
  inTerms,
  notMore,
  repeatable,
  TOPICS as topics,
} from '../golden-counting-fixtures';

const ADR = 'docs/adr/0012 §2 (repeat-for-credit counting)';
const AC04 = 'planning/13 AC04 (duplicate credit only when policy explicitly permits it)';

const CAP_TWO_ATTEMPTS = repeatable(31, [2, null]);
const CAP_400_CREDITS = repeatable(33, [null, 400]);
const CAP_600_CREDITS = repeatable(34, [null, 600]);

/** Counting cases for courses repeatable for credit, within, at, and over their caps. */
export const REPEAT_CREDIT_CAP_CASES: readonly GoldenCountingCase[] = [
  countingCase({
    id: 'GC-RCR-001',
    title: 'Three ensemble attempts within the 4-attempt and 4.00-credit caps all count',
    requirementIds: ['FR-06', 'AC04'],
    inputs: countingInputs({ courses: [ensemble], attempts: inTerms(ensemble, 3, 100) }),
    expected: counted(300),
    prohibitedClaims: [{ earnedCreditsHundredths: 100, claim: 'must not count only one attempt' }],
    rationale: 'Three attempts of 1.00 are inside both caps, so each counts: 3.00.',
    citations: [ADR, AC04],
  }),
  countingCase({
    id: 'GC-RCR-002',
    title: 'Four ensemble attempts exactly at both caps all count',
    requirementIds: ['FR-06', 'AC04'],
    inputs: countingInputs({ courses: [ensemble], attempts: inTerms(ensemble, 4, 100) }),
    expected: counted(400),
    prohibitedClaims: [
      { earnedCreditsHundredths: 300, claim: 'must not drop an attempt at the cap' },
    ],
    rationale: 'maxAttempts 4 and maxCredits 4.00: four attempts of 1.00 meet both caps exactly.',
    citations: [ADR, AC04],
  }),
  countingCase({
    id: 'GC-RCR-003',
    title: 'A fifth ensemble attempt over the 4-attempt cap earns nothing more',
    requirementIds: ['FR-06', 'AC04'],
    inputs: countingInputs({ courses: [ensemble], attempts: inTerms(ensemble, 5, 100) }),
    expected: counted(400),
    prohibitedClaims: [notMore(500)],
    rationale:
      'Five completed attempts in five terms: the first four count, the fifth is over maxAttempts. Earned 4.00.',
    citations: [ADR, 'issue #365 acceptance example'],
  }),
  countingCase({
    id: 'GC-RCR-004',
    title: 'Two attempts of an uncapped topics course earn 6.00',
    requirementIds: ['FR-06', 'AC04'],
    inputs: countingInputs({ courses: [topics], attempts: inTerms(topics, 2, 300) }),
    expected: counted(600),
    prohibitedClaims: [{ earnedCreditsHundredths: 300, claim: 'must not count only one attempt' }],
    rationale: 'Both caps are null, so no cap is stated: both attempts count.',
    citations: [ADR, AC04],
  }),
  countingCase({
    id: 'GC-RCR-005',
    title: 'A 4.00 credit cap cuts two 3.00 attempts to 4.00',
    requirementIds: ['FR-06', 'AC04'],
    inputs: countingInputs({
      courses: [CAP_400_CREDITS],
      attempts: inTerms(CAP_400_CREDITS, 2, 300),
    }),
    expected: counted(400),
    prohibitedClaims: [notMore(600)],
    rationale: 'The sum 6.00 is capped at maxCreditsHundredths 400.',
    citations: [ADR, 'issue #365 acceptance example'],
  }),
  countingCase({
    id: 'GC-RCR-006',
    title: 'Two 3.00 attempts exactly at a 6.00 credit cap earn 6.00',
    requirementIds: ['FR-06', 'AC04'],
    inputs: countingInputs({
      courses: [CAP_600_CREDITS],
      attempts: inTerms(CAP_600_CREDITS, 2, 300),
    }),
    expected: counted(600),
    prohibitedClaims: [
      { earnedCreditsHundredths: 300, claim: 'must not drop an attempt at the cap' },
    ],
    rationale: 'The sum equals the cap, so nothing is cut.',
    citations: [ADR],
  }),
  countingCase({
    id: 'GC-RCR-007',
    title: 'An attempt cap alone counts the earliest attempts and no more',
    requirementIds: ['FR-06', 'AC04'],
    inputs: countingInputs({
      courses: [CAP_TWO_ATTEMPTS],
      attempts: inTerms(CAP_TWO_ATTEMPTS, 3, 300),
    }),
    expected: counted(600),
    prohibitedClaims: [notMore(900)],
    rationale: 'maxAttempts 2 with no credit cap: the first two of three attempts count, 6.00.',
    citations: [ADR],
  }),
  countingCase({
    id: 'GC-RCR-008',
    title: 'A failed attempt between two passing ones does not use up the attempt cap',
    requirementIds: ['FR-06', 'AC04'],
    inputs: countingInputs({
      courses: [CAP_TWO_ATTEMPTS],
      attempts: [
        attemptOf(CAP_TWO_ATTEMPTS, 1, ['2025FA', 300]),
        completedAttempt(
          {
            courseId: CAP_TWO_ATTEMPTS.id,
            termCode: '2026SP',
            grade: letter('F'),
            creditsEarnedHundredths: 0,
          },
          2,
        ),
        attemptOf(CAP_TWO_ATTEMPTS, 3, ['2026FA', 300]),
        attemptOf(CAP_TWO_ATTEMPTS, 4, ['2027SP', 300]),
      ],
    }),
    expected: counted(600),
    prohibitedClaims: [
      { earnedCreditsHundredths: 300, claim: 'must not spend an attempt on the failure' },
    ],
    rationale:
      'The F earned 0 credits, so it is not a countable attempt. maxAttempts 2 counts the first two passing attempts (2025FA, 2026FA): 6.00.',
    citations: [ADR],
  }),
  countingCase({
    id: 'GC-RCR-009',
    title: 'A repeatable course counts a completed and a transfer-awarded attempt',
    requirementIds: ['FR-06', 'AC04'],
    inputs: countingInputs({
      courses: [ensemble],
      attempts: [
        attemptOf(ensemble, 1, ['2025FA', 100]),
        completedAttempt(
          {
            courseId: ensemble.id,
            termCode: '2026SP',
            status: AttemptStatus.TransferAwarded,
            creditsEarnedHundredths: 100,
          },
          2,
        ),
      ],
    }),
    expected: counted(200),
    prohibitedClaims: [
      { earnedCreditsHundredths: 100, claim: 'must not ignore the awarded transfer' },
    ],
    rationale: 'COMPLETED and TRANSFER_AWARDED attempts that earned credit both count.',
    citations: [ADR],
  }),
  countingCase({
    id: 'GC-RCR-010',
    title: 'In-progress and pending-transfer attempts earn nothing beside counted ones',
    requirementIds: ['FR-06', 'AC04'],
    inputs: countingInputs({
      courses: [ensemble],
      attempts: [
        attemptOf(ensemble, 1, ['2025FA', 100]),
        attemptOf(ensemble, 2, ['2026SP', 100]),
        inProgressAttempt({ courseId: ensemble.id, termCode: '2026FA' }, 3),
        pendingTransferAttempt({ courseId: ensemble.id, termCode: '2027SP' }, 4),
      ],
    }),
    expected: counted(200),
    prohibitedClaims: [notMore(300), notMore(400)],
    rationale:
      'Only the two completed attempts earn credit; IN_PROGRESS and TRANSFER_PENDING earn nothing.',
    citations: [ADR, 'planning/08 §Candidate formation (pending credit is never earned)'],
  }),
  countingCase({
    id: 'GC-RCR-011',
    title: 'A repeatable course with only an in-progress attempt has no counting attempt',
    requirementIds: ['FR-06', 'AC04'],
    inputs: countingInputs({
      courses: [ensemble],
      attempts: [inProgressAttempt({ courseId: ensemble.id, termCode: '2026FA' }, 1)],
    }),
    expected: NO_COUNTING_ATTEMPT,
    prohibitedClaims: [
      { earnedCreditsHundredths: 100, claim: 'must not earn credit for work in progress' },
    ],
    rationale: 'No countable attempt: NONE, earned 0.',
    citations: [ADR],
  }),
];
