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
  // NOTE: the schedule-options endpoint isn't built yet (#221), so every case through it fails
  // until it lands. #221's PR removes these entries.
  ['AC06: blocks the lecture when its only lab conflicts, with the conflict as evidence', 221],
  ['AC06: offers the lecture only with the lab that fits', 221],
  ['AC06: needs verification when the lab component permits no section', 221],
  ['AC06: needs verification, never validated, when a linked lab adds its own credits', 221],
  ['AC06: needs verification when an included lab has a prerequisite of its own', 221],
  ['AC07: allows the same weekly time in the two halves of the term', 221],
  ['AC07: rejects the same weekly time in the same half', 221],
  ['AC07: rejects halves that share a single meeting date', 221],
  ['AC08: rejects ten minutes between campuses when fifteen are required', 221],
  ['AC08: allows a gap exactly equal to the required transition time', 221],
  ['AC08: is unknown, never feasible, when the pair is not configured', 221],
  ['AC08: is unknown when the tenant has no transition table at all', 221],
  [
    'AC12: reports SEARCH_TIMEOUT, never NO_FEASIBLE_PLAN, when the cap stops before a candidate',
    221,
  ],
  ['AC12: completes a search that needs exactly the cap', 221],
  ['AC12: finds the option under the documented default cap', 221],
  ['AC32: gives exactly two options from four sections with conflicts', 221],
  ['AC32: blocks the prerequisite on every option after the grade changes to a D', 221],
  ['AC32: shows UNKNOWN, never PASS, where a removed meeting time could conflict', 221],
  ['AC32: refers a stale section snapshot with 409 STALE_SOURCE', 221],
  ['AC33: pins the section snapshot, transition version, work cap, and request hash', 221],
  ['AC33: replays the same request on unchanged inputs deep-equal', 221],
  ['AC33: hashes the same request with its courses in another order the same', 221],
  ['AC33: needs verification when a requested course has no section', 221],
  ['AC33: is 503 SOURCE_UNAVAILABLE when the term has no published snapshot', 221],
  ['AC33: refers a tie for the latest snapshot with 409 STALE_SOURCE', 221],
  ['AC33: still serves a snapshot exactly 24 hours old', 221],
  ['AC34: serves the student and the assigned advisor', 221],
  ['AC34: answers everyone else exactly as it answers a missing student', 221],
  ['AC34: rejects a body that names a tenant, a role, or a user with 400', 221],
  ['AC34: never offers a section inside a hard unavailable time', 221],
  [
    'AC34: proves no plan, never a relaxed one, when every section is inside the hard unavailable time',
    221,
  ],
  ['AC34: states seats and registration only as the fixed limitation codes', 221],
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
