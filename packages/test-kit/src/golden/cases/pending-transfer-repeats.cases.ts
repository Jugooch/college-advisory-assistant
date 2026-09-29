/**
 * @file Golden cases: a pending transfer combined with a set repeat policy, an in-progress
 *   attempt, and the progression policy. Each case asks whether the stated condition is still
 *   sufficient once the transfer could be awarded.
 * @module @caa/test-kit/golden/cases/pending-transfer-repeats
 * @requirement FR-06
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckState, ReasonCode, RepeatPolicy } from '@caa/domain';

import {
  completedAttempt,
  inProgressAttempt,
  pendingTransferAttempt,
} from '../../builders/course-attempt.builder';
import { letter } from '../../builders/grade.builder';
import { type GoldenCase } from '../golden-case.schema';
import { prerequisiteCase } from '../golden-case-factories';
import { mustNot, NEVER_PASS_WHEN_UNKNOWN, prerequisiteCheck } from '../golden-expectations';
import { prerequisiteInputs, S3_INTERACTIONS_ADJUDICATED_ON } from '../golden-inputs';
import { GoldenRuleFamily } from '../golden-rule-family';

const ELIGIBILITY = 'planning/08 §Eligibility semantics';
const AC03 = 'planning/13 AC03 (UNKNOWN until approved equivalency/credit exists)';
const CONDITIONAL_TEXT =
  'planning/08 §Authority and result semantics (CONDITIONAL: "If you earn C or higher …")';
const DECISION_TABLE = 'PR #76 decision table (prospects combine by ANY precedence)';
const NOT_SETTLED_FAIL = mustNot(
  CheckState.Fail,
  'must not settle as failed while a transfer that could satisfy it is pending',
);
/** A transfer of DEMO-MATH 101 pending evaluation, from a term before every institutional one. */
const PENDING_2025FA = pendingTransferAttempt({ termCode: '2025FA' }, 3);
const EARN_C = prerequisiteCheck(CheckState.Conditional, ReasonCode.InProgressMinGrade);
const STILL_PENDING = prerequisiteCheck(CheckState.Unknown, ReasonCode.PendingTransfer);

/** Pending transfer × repeat policy × in-progress × progression cases. */
export const PENDING_TRANSFER_REPEAT_CASES: readonly GoldenCase[] = [
  prerequisiteCase({
    id: 'GC-PT-004',
    family: GoldenRuleFamily.PendingTransfer,
    title: 'Under MOST_RECENT, earning C in a later course is sufficient beside a pending transfer',
    requirementIds: ['FR-06', 'T04', 'AC02', 'AC03'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.MostRecent, allowsInProgressPrerequisites: true },
      attempts: [inProgressAttempt({}, 1), pendingTransferAttempt({}, 2)],
    }),
    expected: [EARN_C],
    allowedAlternatives: [[STILL_PENDING]],
    prohibitedClaims: [
      mustNot(CheckState.Pass, 'must not claim eligibility before the grade or the transfer'),
      NOT_SETTLED_FAIL,
    ],
    rationale:
      'The in-progress attempt (2026FA) is later than the pending transfer (2026SP). Under MOST_RECENT it counts even if the transfer is awarded, so "if you earn C" is a sufficient condition. UNKNOWN PENDING_TRANSFER is also safe. Contrast GC-PT-003, where no repeat policy decides.',
    citations: [ELIGIBILITY, CONDITIONAL_TEXT, AC03, 'GC-PT-003 (the same attempts, no policy)'],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GC-PT-005',
    family: GoldenRuleFamily.PendingTransfer,
    title: 'Forbidden progression beside a pending transfer is unknown, not failed',
    requirementIds: ['FR-06', 'T04', 'AC02', 'AC03'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.MostRecent },
      attempts: [inProgressAttempt({}, 1), pendingTransferAttempt({}, 2)],
    }),
    expected: [STILL_PENDING],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Conditional, 'must not offer a condition policy forbids'),
      NOT_SETTLED_FAIL,
    ],
    rationale:
      'The in-progress attempt cannot be relied on (progression forbidden), but the pending transfer could still be awarded with a qualifying grade, so the rule is not settled.',
    citations: [AC03, 'planning/13 AC02', DECISION_TABLE],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GC-PT-006',
    family: GoldenRuleFamily.PendingTransfer,
    title: 'Under HIGHEST_GRADE, a pending transfer keeps a failed D open',
    requirementIds: ['FR-06', 'T04', 'AC03'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.HighestGrade },
      attempts: [completedAttempt({ grade: letter('D') }, 1), PENDING_2025FA],
    }),
    expected: [STILL_PENDING],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_SETTLED_FAIL],
    rationale:
      'The D alone fails a C minimum, but under HIGHEST_GRADE an awarded transfer with C or higher would count instead, so a FAIL would be premature.',
    citations: [AC03, ELIGIBILITY, DECISION_TABLE],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GC-PT-007',
    family: GoldenRuleFamily.PendingTransfer,
    title: 'Under MOST_RECENT, an earlier pending transfer does not unsettle a later B',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.MostRecent },
      attempts: [completedAttempt({}, 1), PENDING_2025FA],
    }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [mustNot(CheckState.Fail, 'must not block a student who met the minimum')],
    rationale:
      'The B (2026SP) is later than the pending transfer (2025FA), so under MOST_RECENT it keeps counting even if the transfer is awarded. It passes by current evidence.',
    citations: [
      'planning/08 §Authority and result semantics (PASS: satisfied by current evidence)',
      'PR #76 decision table (pending transfer never replaces a grade)',
    ],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GC-PT-008',
    family: GoldenRuleFamily.PendingTransfer,
    title: 'Under HIGHEST_GRADE, a retake after a D is not sufficient beside a pending transfer',
    requirementIds: ['FR-06', 'T04', 'AC02', 'AC03'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.HighestGrade, allowsInProgressPrerequisites: true },
      attempts: [
        completedAttempt({ grade: letter('D') }, 1),
        inProgressAttempt({}, 2),
        PENDING_2025FA,
      ],
    }),
    expected: [STILL_PENDING],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(
        CheckState.Conditional,
        '"If you earn C" is not sufficient: a transfer awarded as P could not be ranked',
      ),
      mustNot(CheckState.Fail, 'must not block a retake that can still satisfy the rule'),
    ],
    rationale:
      'Earning C in the retake would settle HIGHEST_GRADE among letters, but the transfer may be awarded as a P, and HIGHEST_GRADE cannot rank a P against a letter. CONDITIONAL must state a sufficient condition, so the rule stays UNKNOWN until the transfer is decided.',
    citations: [
      CONDITIONAL_TEXT,
      AC03,
      'GC-REP-007 (HIGHEST_GRADE cannot rank a P against a D)',
      'GC-PT-003 (a CONDITIONAL must be sufficient beside a pending transfer)',
    ],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
  prerequisiteCase({
    id: 'GC-REP-013',
    family: GoldenRuleFamily.Repeat,
    title: 'A MOST_RECENT retake of a passed course is conditional beside a pending transfer',
    requirementIds: ['FR-06', 'T04', 'AC02'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.MostRecent, allowsInProgressPrerequisites: true },
      attempts: [completedAttempt({}, 1), inProgressAttempt({}, 2), PENDING_2025FA],
    }),
    expected: [EARN_C],
    allowedAlternatives: [[STILL_PENDING]],
    prohibitedClaims: [
      mustNot(CheckState.Pass, 'must not keep a B the retake will replace'),
      mustNot(CheckState.Fail, 'must not block a student who can still meet the minimum'),
    ],
    rationale:
      'The 2026FA retake is the most recent attempt, later than both the B and the pending transfer (2025FA), so its grade will decide. "If you earn C" is sufficient; the B no longer is. As in GC-PT-004, UNKNOWN PENDING_TRANSFER is also safe.',
    citations: [CONDITIONAL_TEXT, 'GC-REP-008 (the same retake, no transfer)', DECISION_TABLE],
    adjudicatedOn: S3_INTERACTIONS_ADJUDICATED_ON,
  }),
];
