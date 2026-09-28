/**
 * @file Combines the states of a prerequisite node's children with three-valued AND/OR logic.
 * @module @caa/engine/verification/combine-prerequisite-states
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { CheckState } from '@caa/domain';

/** `ALL` precedence: the first state present in the children wins. */
const ALL_PRECEDENCE: readonly CheckState[] = [
  CheckState.Fail,
  CheckState.Unknown,
  CheckState.Conditional,
  CheckState.Pass,
];

/** `ANY` precedence: the first state present in the children wins. */
const ANY_PRECEDENCE: readonly CheckState[] = [
  CheckState.Pass,
  CheckState.Conditional,
  CheckState.Unknown,
  CheckState.Fail,
];

/**
 * Combines the children of an `ALL` node: every child must be satisfied.
 *
 * Truth table for two children; more children fold the same way, and the operator is
 * commutative and associative, so nesting and child order never change the state:
 *
 * | ALL         | PASS        | CONDITIONAL | UNKNOWN | FAIL |
 * | ----------- | ----------- | ----------- | ------- | ---- |
 * | PASS        | PASS        | CONDITIONAL | UNKNOWN | FAIL |
 * | CONDITIONAL | CONDITIONAL | CONDITIONAL | UNKNOWN | FAIL |
 * | UNKNOWN     | UNKNOWN     | UNKNOWN     | UNKNOWN | FAIL |
 * | FAIL        | FAIL        | FAIL        | FAIL    | FAIL |
 *
 * @param states - The state of every child, at least one.
 * @returns FAIL if any child fails, else UNKNOWN if any is unknown, else CONDITIONAL if any is
 *   conditional, else PASS. An empty list is UNKNOWN, never a vacuous PASS.
 */
export function combineAllStates(states: readonly CheckState[]): CheckState {
  // SAFETY: an UNKNOWN child is never read as satisfied, so ALL can reach PASS only when every
  // child passed (planning/08 §Authority and result semantics: UNKNOWN is not PASS).
  return firstPresent(states, ALL_PRECEDENCE);
}

/**
 * Combines the children of an `ANY` node: at least one child must be satisfied.
 *
 * Truth table for two children; more children fold the same way, and the operator is
 * commutative and associative, so nesting and child order never change the state:
 *
 * | ANY         | PASS | CONDITIONAL | UNKNOWN     | FAIL        |
 * | ----------- | ---- | ----------- | ----------- | ----------- |
 * | PASS        | PASS | PASS        | PASS        | PASS        |
 * | CONDITIONAL | PASS | CONDITIONAL | CONDITIONAL | CONDITIONAL |
 * | UNKNOWN     | PASS | CONDITIONAL | UNKNOWN     | UNKNOWN     |
 * | FAIL        | PASS | CONDITIONAL | UNKNOWN     | FAIL        |
 *
 * @param states - The state of every alternative, at least one.
 * @returns PASS if any child passes, else CONDITIONAL if any is conditional, else UNKNOWN if
 *   any is unknown, else FAIL. An empty list is UNKNOWN, never a vacuous FAIL or PASS.
 */
export function combineAnyStates(states: readonly CheckState[]): CheckState {
  // SAFETY: an UNKNOWN alternative might be satisfied, so ANY of UNKNOWN and FAIL is UNKNOWN,
  // never FAIL, and never PASS (planning/08 §Eligibility semantics: OR keeps its structure).
  return firstPresent(states, ANY_PRECEDENCE);
}

/**
 * Picks the first state in a precedence list that appears among the children.
 *
 * @param states - The children's states.
 * @param precedence - Every state, strongest first.
 * @returns The strongest state present, or UNKNOWN when there are no children.
 */
function firstPresent(
  states: readonly CheckState[],
  precedence: readonly CheckState[],
): CheckState {
  // SAFETY: the domain rejects empty groups, but if one ever arrives it has no source meaning,
  // so it is UNKNOWN rather than vacuously true or false (prerequisite-expression.model.ts).
  return precedence.find((state) => states.includes(state)) ?? CheckState.Unknown;
}
