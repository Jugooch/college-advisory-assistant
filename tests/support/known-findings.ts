/**
 * @file The one register of known findings: golden cases and acceptance tests whose
 *   planning-derived expectation the code doesn't meet yet (docs/standards/07-testing.md, Known
 *   findings). It imports no test runner, so Vitest and Playwright read the same data. Test files
 *   declare tests through the helpers in {@link ./known-findings-declarations} (Vitest) or
 *   `tests/e2e/support/known-findings` (Playwright), never with a hard-coded expected failure.
 * @module @caa/tests/support/known-findings
 * @requirement NFR-01
 * @see docs/standards/07-testing.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */

/**
 * Open findings by key, each with the `bug` issue that tracks it. A key is:
 * - a golden case ID, development or holdout, for example `GC-PF-004`;
 * - an acceptance test: `ACNN: <exact it title>`, for example
 *   `AC29: keeps CONDITIONAL end to end`.
 *
 * The fixing PR removes its entry, and nothing else in `tests/`.
 */
export const KNOWN_FINDINGS: ReadonlyMap<string, number> = new Map<string, number>([
  [
    'AC51: blocks the student missing a prerequisite with FAIL MIN_GRADE_NOT_MET, never UNKNOWN or PASS',
    609,
  ],
  ['AC51: leaves the pending transfer UNKNOWN with PENDING_TRANSFER, never PASS', 609],
  ['AC51: reads the saved plan STALE with STUDENT_RECORD_SUPERSEDED after a newer record', 609],
]);

/** A key of the register: a golden case ID, or an acceptance case and its exact test title. */
export const FINDING_KEY = /^(G[CH]-[A-Z]+-\d{3}|AC\d{2}: \S.*)$/;

/** A test that runs normally: its key isn't in the register. */
export interface PlainTest {
  readonly kind: 'test';
}

/** A test that runs as an expected failure while its finding is open. */
export interface ExpectedFailure {
  readonly kind: 'expected-failure';
  /** The `bug` issue that tracks the finding. */
  readonly issue: number;
}

/** How a test is registered: as a plain test, or as an expected failure of an open finding. */
export type FindingMode = PlainTest | ExpectedFailure;

/**
 * Looks up how a test runs.
 *
 * @param key - The test's register key.
 * @param register - The register; the shared {@link KNOWN_FINDINGS} unless a test passes its own.
 * @returns An expected failure with its issue while the key is listed, otherwise a plain test.
 */
export function findingMode(
  key: string,
  register: ReadonlyMap<string, number> = KNOWN_FINDINGS,
): FindingMode {
  const issue = register.get(key);
  return issue === undefined ? { kind: 'test' } : { kind: 'expected-failure', issue };
}
