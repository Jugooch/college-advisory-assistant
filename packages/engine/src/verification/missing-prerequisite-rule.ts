/**
 * @file Reports the prerequisite check of a course that has no rule in the pinned ruleset.
 * @module @caa/engine/verification/missing-prerequisite-rule
 * @requirement FR-05
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0012-explicit-no-prerequisite-and-repeat-credit.md
 */
import {
  CheckKind,
  type CheckResult,
  CheckState,
  createCheckResult,
  ReasonCode,
} from '@caa/domain';

/**
 * Builds the prerequisite check of a course whose rule isn't in the pinned ruleset. A course
 * with no prerequisite has an explicit `NONE` rule, so a missing rule means it wasn't imported.
 *
 * @param rulesetVersion - The pinned ruleset version that was searched for the rule.
 * @returns An UNKNOWN PREREQUISITE check with reason `PREREQUISITE_RULE_MISSING`, no source
 *   reference, and evidence holding the ruleset version and no decisive leaves.
 */
export function missingPrerequisiteRuleCheck(rulesetVersion: string): CheckResult {
  // SAFETY: an absent rule row is missing data, not a statement that the course has no
  // prerequisite, so it is UNKNOWN and never PASS (ADR-0012 §1; planning/08 §Eligibility
  // semantics).
  return createCheckResult({
    kind: CheckKind.Prerequisite,
    state: CheckState.Unknown,
    reasonCode: ReasonCode.PrerequisiteRuleMissing,
    evidence: { rulesetVersion, decisiveLeaves: [] },
  });
}
