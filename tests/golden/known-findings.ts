/**
 * @file Golden cases whose planning-derived expectation the engine doesn't meet yet. Each entry
 *   names the open `bug` issue; the case runs as an expected failure until the engine is fixed.
 * @module @caa/tests/golden/known-findings
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */

/** Open findings by golden case ID: the `bug` issue number that tracks each disagreement. */
export const KNOWN_FINDINGS: ReadonlyMap<string, number> = new Map<string, number>([
  ['GC-PF-004', 183],
]);
