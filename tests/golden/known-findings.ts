/**
 * @file Golden cases whose planning-derived expectation the engine doesn't meet yet. Each entry
 *   names the open `bug` issue; the case runs as an expected failure until the engine is fixed.
 * @module @caa/tests/golden/known-findings
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */

/** Open findings by golden case ID: the `bug` issue number that tracks each disagreement. */
export const KNOWN_FINDINGS: ReadonlyMap<string, number> = new Map<string, number>([
  // TODO(#88): the engine returns CONDITIONAL for a MOST_RECENT retake when progression is forbidden.
  ['GC-REP-012', 88],
  // TODO(#89): the engine returns CONDITIONAL beside a pending transfer with no repeat policy.
  ['GC-PT-003', 89],
]);
