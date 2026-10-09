/**
 * @file The known-findings register data and lookup, free of any test-runner import so both
 *   Vitest ({@link ./known-findings}) and Playwright (`tests/e2e/support`) read the same register.
 * @module @caa/tests/support/known-findings-register
 * @requirement NFR-01
 * @see docs/standards/07-testing.md
 */

/**
 * Open findings by key, each with the `bug` issue that tracks it. A key is:
 * - a golden case ID, development or holdout, for example `GC-PF-004`;
 * - an acceptance test: `ACNN: <exact it title>`, for example
 *   `AC29: keeps CONDITIONAL end to end`.
 *
 * The fixing PR removes its entry, and nothing else in `tests/`.
 */
export const KNOWN_FINDINGS: ReadonlyMap<string, number> = new Map<string, number>([]);

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
