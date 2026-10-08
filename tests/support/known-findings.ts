/**
 * @file The one register of known findings: golden cases and acceptance tests whose
 *   planning-derived expectation the code doesn't meet yet (docs/standards/07-testing.md, Known
 *   findings). A listed test runs as `it.fails`; every other test runs as `it`. Test files never
 *   hard-code `it.fails`: they declare tests through {@link itForFinding} or
 *   {@link acceptanceIt}, which read this register.
 * @module @caa/tests/support/known-findings
 * @requirement NFR-01
 * @see docs/standards/07-testing.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { it } from 'vitest';

/**
 * Open findings by key, each with the `bug` issue that tracks it. A key is:
 * - a golden case ID, development or holdout, for example `GC-PF-004`;
 * - an acceptance test: `ACNN: <exact it title>`, for example
 *   `AC29: keeps CONDITIONAL end to end`.
 *
 * The fixing PR removes its entry, and nothing else in `tests/`.
 */
export const KNOWN_FINDINGS: ReadonlyMap<string, number> = new Map<string, number>([
  // The save returns 200; the contract (plan-drafts.contract.ts) says 201 (#443).
  [
    'AC32: saves an offered option as revision 1, cause SAVED, equal to what the student was shown',
    443,
  ],
  ['AC32: saves a result with no options and a null chosen section set as revision 1', 443],
]);

/** A key of the register: a golden case ID, or an acceptance case and its exact test title. */
export const FINDING_KEY = /^(G[CH]-[A-Z]+-\d{3}|AC\d{2}: \S.*)$/;

/**
 * An `acceptanceIt('ACNN', '<title>', …)` declaration: the case ID, then the title in single or
 * double quotes (Prettier picks double quotes when the title holds an apostrophe).
 */
const ACCEPTANCE_DECLARATION = /acceptanceIt\(\s*'(AC\d{2})',\s*(['"])((?:\\.|(?!\2)[^\\\n])*)\2/g;

/**
 * Lists the register keys that a test file declares through {@link acceptanceIt}.
 *
 * @param source - The test file's source text.
 * @returns `ACNN: <title>` for each declaration, in source order.
 */
export function declaredAcceptanceKeys(source: string): readonly string[] {
  return [...source.matchAll(ACCEPTANCE_DECLARATION)].map(
    ([, caseId = '', , title = '']) => `${caseId}: ${title.replaceAll(/\\(.)/g, '$1')}`,
  );
}

/**
 * A hard-coded expected failure in a test file, such as `it.fails(`, `test.fails(` or
 * `it.fails.each(`. Test files declare expected failures through the register instead.
 */
export const HARD_CODED_EXPECTED_FAILURE = /\b(?:it|test)\.fails\b/;

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

/**
 * Declares a test that runs as `it.fails` while its key is a known finding, and as `it`
 * otherwise. An expected failure's title names the open issue.
 *
 * @param key - The test's register key.
 * @param title - The test title.
 * @param test - The test body.
 */
export function itForFinding(key: string, title: string, test: () => void | Promise<void>): void {
  const mode = findingMode(key);
  if (mode.kind === 'test') {
    it(title, test);
    return;
  }
  it.fails(`${title} (open finding #${String(mode.issue)})`, test);
}

/**
 * Declares one acceptance test under the register key `<caseId>: <title>`. Pass both arguments as
 * single-quoted string literals: the register guard finds declared keys by reading the source.
 *
 * @param caseId - The acceptance case, for example `AC29`.
 * @param title - The exact test title.
 * @param test - The test body.
 */
export function acceptanceIt(
  caseId: string,
  title: string,
  test: () => void | Promise<void>,
): void {
  itForFinding(`${caseId}: ${title}`, title, test);
}
