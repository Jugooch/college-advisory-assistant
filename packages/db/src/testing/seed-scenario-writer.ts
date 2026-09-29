/**
 * @file Writes the dev seed scenarios, or a plan a test built, into a test database. Test code
 *   only; exposed to other packages through `@caa/db/testing`.
 * @module @caa/db/testing/seed-scenario-writer
 * @requirement FR-03
 * @see docs/standards/07-testing.md
 */
import type { Database } from '../client';
import { buildDevSeedPlan, type DevSeedPlan } from '../seed/dev-seed-plan';
import { type SeedCounts, seedDevData } from '../seed/seed-dev-data';

/**
 * What to write: the dev seed plan built at a fixed time, or a complete plan the test built
 * (for example the dev seed plan with some academic records changed).
 */
export type SeedScenarioSource = { readonly now: Date } | { readonly plan: DevSeedPlan };

/**
 * Writes the seed scenarios (SYN-000001 current, SYN-000002 stale, and the rest of the dev seed)
 * or the given plan, in one transaction, through the same writer and reference checks as
 * `db:seed`. Running it again with the same source leaves the same rows.
 *
 * Every integration file in a run shares one database, and the snapshot and audit IDs
 * derive from `now`, so a different `now` adds a newer revision that other files then read as
 * latest. Pass the same fixed time as the other callers, and assert relative to what is latest.
 *
 * @param db - Handle to a test database that has every migration applied.
 * @param source - `{ now }` to build the dev seed plan relative to that time, or `{ plan }`.
 * @returns How many records of each kind the plan holds.
 * @throws {AcademicSeedReferenceError} When the plan's academic records refer to something the
 *   plan doesn't contain; nothing is written.
 * @throws {RangeError} When `now` is an invalid date.
 */
export async function writeSeedScenario(
  db: Database,
  source: SeedScenarioSource,
): Promise<SeedCounts> {
  const plan = 'plan' in source ? source.plan : buildDevSeedPlan(source.now);
  return seedDevData(db, plan);
}
