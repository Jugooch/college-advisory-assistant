/**
 * @file Golden cases: an explicit `NONE` rule is PASS, and a course with no rule row is UNKNOWN
 *   `PREREQUISITE_RULE_MISSING`, never PASS (ADR-0012 §1).
 * @module @caa/test-kit/golden/cases/no-prerequisite
 * @requirement FR-05
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/adr/0012-explicit-no-prerequisite-and-repeat-credit.md
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { CheckKind, CheckState, ReasonCode } from '@caa/domain';

import {
  completedAttempt,
  inProgressAttempt,
  pendingTransferAttempt,
} from '../../builders/course-attempt.builder';
import { letter } from '../../builders/grade.builder';
import { buildPrerequisiteRule, none } from '../../builders/prerequisite-rule.builder';
import { type GoldenCase } from '../golden-case.schema';
import { prerequisiteCase } from '../golden-case-factories';
import {
  expectedCheck,
  mustNot,
  NEVER_PASS_WHEN_UNKNOWN,
  prerequisiteCheck,
} from '../golden-expectations';
import { GOLDEN_RULE_REF, prerequisiteInputs } from '../golden-inputs';
import { GoldenRuleFamily } from '../golden-rule-family';

const ADR = 'docs/adr/0012 §1 (an explicit NONE rule is PASS; a missing rule row is UNKNOWN)';
const SPLIT = 'issue #141 split comment (explicit NONE versus missing rule)';
const NONE_RULE = buildPrerequisiteRule({ expression: none() });
const NOT_FAILED = mustNot(CheckState.Fail, 'must not block a course that states no prerequisite');
const NOT_CONDITIONAL = mustNot(CheckState.Conditional, 'must not offer a condition to meet');
const NOT_UNKNOWN = mustNot(
  CheckState.Unknown,
  'must not hold back a course that states no prerequisite',
);
const NOT_MISSING_FAIL = mustNot(
  CheckState.Fail,
  'must not block a course on a rule that was never imported',
);
const PASS_NO_LEAVES = prerequisiteCheck(CheckState.Pass, null, { decisiveLeaves: [] });
const MISSING = expectedCheck(CheckKind.Prerequisite, {
  state: CheckState.Unknown,
  reasonCode: ReasonCode.PrerequisiteRuleMissing,
  evidence: { rulesetVersion: 'demo-2026.1', decisiveLeaves: [] },
});

/** Explicit-NONE and missing-rule cases. The rule, when present, is DEMO-MATH 102's. */
export const NO_PREREQUISITE_CASES: readonly GoldenCase[] = [
  prerequisiteCase({
    id: 'GC-NOPRE-001',
    family: GoldenRuleFamily.NoPrerequisite,
    title: 'An explicit NONE rule passes with an empty record',
    requirementIds: ['FR-05', 'FR-06'],
    inputs: prerequisiteInputs({ rule: NONE_RULE, attempts: [] }),
    expected: [PASS_NO_LEAVES],
    prohibitedClaims: [NOT_UNKNOWN, NOT_FAILED, NOT_CONDITIONAL],
    rationale:
      'The institution stated that the course has no prerequisite, so no record is needed. The result cites the rule and has no decisive leaves.',
    citations: [ADR, SPLIT, 'planning/08 §Eligibility semantics'],
  }),
  prerequisiteCase({
    id: 'GC-NOPRE-002',
    family: GoldenRuleFamily.NoPrerequisite,
    title: 'An explicit NONE rule passes whatever the record holds',
    requirementIds: ['FR-05', 'FR-06', 'NFR-01'],
    inputs: prerequisiteInputs({
      rule: NONE_RULE,
      attempts: [
        completedAttempt({ grade: letter('F') }, 1),
        inProgressAttempt({}, 2),
        pendingTransferAttempt({}, 3),
      ],
    }),
    expected: [PASS_NO_LEAVES],
    prohibitedClaims: [NOT_UNKNOWN, NOT_FAILED, NOT_CONDITIONAL],
    rationale:
      'A failed, an in-progress and a pending-transfer attempt of the prerequisite course of another rule don’t matter: a NONE rule asks nothing of the record.',
    citations: [ADR, SPLIT],
  }),
  prerequisiteCase({
    id: 'GC-NOPRE-003',
    family: GoldenRuleFamily.NoPrerequisite,
    title: 'An explicit NONE rule passes when the catalog lists no courses',
    requirementIds: ['FR-05', 'FR-06'],
    inputs: prerequisiteInputs({ rule: NONE_RULE, courses: [], attempts: [] }),
    expected: [PASS_NO_LEAVES],
    prohibitedClaims: [
      mustNot(CheckState.Unknown, 'must not report a catalog gap: a NONE rule names no course'),
      NOT_FAILED,
    ],
    rationale:
      'Boundary: with nothing to look up, a NONE rule can’t hit a catalog gap, so it still passes.',
    citations: [ADR, SPLIT],
  }),
  prerequisiteCase({
    id: 'GC-NOPRE-004',
    family: GoldenRuleFamily.NoPrerequisite,
    title: 'A course with no rule row is UNKNOWN PREREQUISITE_RULE_MISSING',
    requirementIds: ['FR-05', 'FR-06', 'NFR-01'],
    inputs: prerequisiteInputs({ rule: null, attempts: [] }),
    expected: [MISSING],
    prohibitedClaims: [
      NEVER_PASS_WHEN_UNKNOWN,
      mustNot(CheckState.Pass, `must not cite ${GOLDEN_RULE_REF}: there is no rule to cite`),
      NOT_MISSING_FAIL,
    ],
    rationale:
      'No rule row means the rule was not imported. That is missing data, so the check is UNKNOWN and never PASS, with no decisive leaves. The engine has no rule lookup yet, so this case runs its missing-rule check directly; the lookup, and the record being irrelevant, are covered by the AC29 acceptance cases (#362).',
    citations: [ADR, SPLIT, 'planning/08 §Eligibility semantics (UNKNOWN is never PASS)'],
  }),
];
