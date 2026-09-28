/**
 * @file Golden cases: in-progress prerequisites under both progression policies, pending transfer,
 *   incomplete (deferred-grade) attempts, and catalog gaps.
 * @module @caa/test-kit/golden/cases/attempt-status
 * @requirement FR-06
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckState, ReasonCode, RepeatPolicy } from '@caa/domain';

import { buildCourse } from '../../builders/course.builder';
import {
  completedAttempt,
  incompleteAttempt,
  inProgressAttempt,
  pendingTransferAttempt,
} from '../../builders/course-attempt.builder';
import { letter } from '../../builders/grade.builder';
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

const ELIGIBILITY = 'planning/08 §Eligibility semantics';
const NOT_ELIGIBLE = mustNot(CheckState.Pass, 'must not claim the prerequisite is met');
const NOT_SETTLED_FAIL = mustNot(
  CheckState.Fail,
  'must not settle as failed while evidence is pending',
);
/** A course that exists in the synthetic tenant but is left out of the catalog on purpose. */
const UNCATALOGUED = buildCourse({}, 0x999);

/** In-progress, pending-transfer, incomplete, and catalog-gap cases. */
export const ATTEMPT_STATUS_CASES: readonly GoldenCase[] = [
  prerequisiteCase({
    id: 'GC-IP-001',
    family: GoldenRuleFamily.InProgress,
    title: 'An in-progress prerequisite is conditional when policy permits progression',
    requirementIds: ['FR-06', 'T04', 'AC02'],
    inputs: prerequisiteInputs({
      policy: { allowsInProgressPrerequisites: true },
      attempts: [inProgressAttempt()],
    }),
    expected: [
      prerequisiteCheck(CheckState.Conditional, ReasonCode.InProgressMinGrade, {
        decisiveLeaves: [
          courseLeaf({
            path: [],
            courseId: SYNTHETIC_COURSES.math101.id,
            requiredGrade: letter('C'),
            attemptSeeds: [1],
            reasonCode: ReasonCode.InProgressMinGrade,
          }),
        ],
      }),
    ],
    prohibitedClaims: [mustNot(CheckState.Pass, 'must not claim unconditional eligibility')],
    rationale:
      'Conditional on earning C and on the institution permitting planned progression, which it does.',
    citations: [
      'planning/13 AC02',
      ELIGIBILITY,
      'planning/08 evidence contract example (IN_PROGRESS_MIN_GRADE, required_grade C)',
    ],
  }),
  prerequisiteCase({
    id: 'GC-IP-002',
    family: GoldenRuleFamily.InProgress,
    title: 'An in-progress prerequisite fails when policy forbids progression',
    requirementIds: ['FR-06', 'T04', 'AC02'],
    inputs: prerequisiteInputs({ attempts: [inProgressAttempt()] }),
    expected: [prerequisiteCheck(CheckState.Fail, ReasonCode.ProgressionNotPermitted)],
    prohibitedClaims: [
      NOT_ELIGIBLE,
      mustNot(CheckState.Conditional, 'must not offer a condition policy forbids'),
    ],
    rationale: 'CONDITIONAL only if institutional progression policy permits; here it does not.',
    citations: [
      'planning/13 AC02',
      ELIGIBILITY,
      'issue #55 (policy forbids → PROGRESSION_NOT_PERMITTED)',
    ],
  }),
  prerequisiteCase({
    id: 'GC-PT-001',
    family: GoldenRuleFamily.PendingTransfer,
    title: 'A pending transfer is unknown until the credit is awarded',
    requirementIds: ['FR-06', 'T04', 'AC03'],
    inputs: prerequisiteInputs({ attempts: [pendingTransferAttempt()] }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.PendingTransfer)],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_SETTLED_FAIL],
    rationale:
      'Pending transfer evaluations never become earned credit automatically, nor are they a known failure.',
    citations: [
      'planning/13 AC03',
      ELIGIBILITY,
      'issue #55 (only a pending transfer → PENDING_TRANSFER)',
    ],
  }),
  prerequisiteCase({
    id: 'GC-PT-002',
    family: GoldenRuleFamily.PendingTransfer,
    title: 'A pending transfer does not unsettle a passing institutional grade',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      attempts: [completedAttempt({}, 1), pendingTransferAttempt({}, 2)],
    }),
    expected: [prerequisiteCheck(CheckState.Pass, null)],
    prohibitedClaims: [mustNot(CheckState.Fail, 'must not block a student who met the minimum')],
    rationale:
      'The completed B already satisfies the rule by current evidence; a pending transfer adds nothing and removes nothing.',
    citations: [
      'planning/08 §Authority and result semantics (PASS: satisfied by current evidence)',
      'PR #76 decision table (pending transfer never replaces a grade)',
    ],
  }),
  prerequisiteCase({
    id: 'GC-PT-003',
    family: GoldenRuleFamily.PendingTransfer,
    title: 'An in-progress course beside a pending transfer of it, with no repeat policy',
    requirementIds: ['FR-06', 'T04', 'AC02', 'AC03'],
    inputs: prerequisiteInputs({
      policy: { allowsInProgressPrerequisites: true },
      attempts: [inProgressAttempt({}, 1), pendingTransferAttempt({}, 2)],
    }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.RepeatPolicyUndefined)],
    allowedAlternatives: [[prerequisiteCheck(CheckState.Unknown, ReasonCode.PendingTransfer)]],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(
        CheckState.Conditional,
        '"If you earn C" is not sufficient: an awarded transfer would make an undecidable repeat',
      ),
    ],
    rationale:
      'If the transfer is awarded with a D, the group holds two countable attempts and no repeat policy decides between them, so earning C does not guarantee the rule. CONDITIONAL must state a sufficient condition.',
    citations: [
      'planning/08 §Authority and result semantics (CONDITIONAL: "If you earn C or higher …")',
      'planning/13 AC03 (UNKNOWN until approved credit exists)',
      'issue #54 (policy unset → UNKNOWN)',
      'PR #76 correctness review finding 1 (unresolved)',
    ],
  }),
  prerequisiteCase({
    id: 'GC-INC-001',
    family: GoldenRuleFamily.IncompleteAttempt,
    title: 'An incomplete retake makes a passed prerequisite unknown',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      policy: { repeatPolicy: RepeatPolicy.MostRecent },
      attempts: [completedAttempt({}, 1), incompleteAttempt({ termCode: '2026FA' }, 2)],
    }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.IncompleteAttempt)],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_SETTLED_FAIL],
    rationale:
      'Under MOST_RECENT the deferred grade may replace the B once recorded, so the outcome is not settled.',
    citations: [
      'PR #76 (tech-lead: an INCOMPLETE attempt → UNKNOWN INCOMPLETE_ATTEMPT)',
      'planning/08 §Authority and result semantics',
    ],
  }),
  prerequisiteCase({
    id: 'GC-CAT-001',
    family: GoldenRuleFamily.CatalogGap,
    title: 'An attempt of an uncatalogued course leaves the record unknown',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      attempts: [
        completedAttempt({}, 1),
        completedAttempt({ courseId: UNCATALOGUED.id, grade: letter('D') }, 2),
      ],
    }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.CourseNotInCatalog)],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_SETTLED_FAIL],
    rationale:
      'The uncatalogued course could be an alias of DEMO-MATH 101; without stable equivalency groups no attempt can be counted.',
    citations: [
      'planning/08 §Candidate formation and allocation (stable equivalency groups)',
      'PR #64 (any uncatalogued attempt → COURSE_NOT_IN_CATALOG)',
    ],
  }),
  prerequisiteCase({
    id: 'GC-CAT-002',
    family: GoldenRuleFamily.CatalogGap,
    title: 'A required course missing from the catalog is unknown, not failed',
    requirementIds: ['FR-06', 'T04'],
    inputs: prerequisiteInputs({
      rule: buildPrerequisiteRule({ expression: course(UNCATALOGUED.id, letter('C')) }),
    }),
    expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.CourseNotInCatalog)],
    prohibitedClaims: [NEVER_PASS_WHEN_UNKNOWN, NOT_SETTLED_FAIL],
    rationale:
      'Without the course in the catalog its equivalents are unknown, so "no qualifying attempt" cannot be claimed.',
    citations: [
      'planning/08 §Authority and result semantics (missing data → UNKNOWN)',
      'PR #76 decision table (required course not in catalog)',
    ],
  }),
];
