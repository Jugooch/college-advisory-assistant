/**
 * @file Evaluates a prerequisite through `@caa/engine`'s public API with the golden defaults, so
 *   acceptance cases state only the policy switches and attempts they are about.
 * @module @caa/tests/support/prerequisite-harness
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { type CheckResult } from '@caa/domain';
import { evaluatePrerequisite } from '@caa/engine';
import { prerequisiteInputs, type PrerequisiteVariation } from '@caa/test-kit';

/**
 * Evaluates the default rule (DEMO-MATH 102 needs DEMO-MATH 101 ≥ C) or the given one against the
 * full synthetic catalog and the synthetic term calendar.
 *
 * @param variation - Policy switches, attempts, and optionally the rule.
 * @returns The PREREQUISITE check.
 */
export function evaluateDefaultPrerequisite(variation: PrerequisiteVariation): CheckResult {
  const { rule, attempts, courses, academicPolicy, termCalendar } = prerequisiteInputs(variation);
  return evaluatePrerequisite(rule, { attempts, courses }, { academicPolicy, termCalendar });
}
