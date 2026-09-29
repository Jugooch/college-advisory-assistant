/**
 * @file Test-only entry point (`@caa/db/testing`) that lets cross-package integration tests write
 *   the seed scenarios into a test database.
 * @module @caa/db/testing
 * @requirement FR-03
 * @see docs/standards/01-repository-structure.md
 *
 * For tests only. The layer-boundary lint forbids every `@caa/<package>/testing` import in
 * production code, and the root entry (`@caa/db`) still exposes only read repositories, so
 * nothing here is shipped or run by the deployed API or worker.
 */
export { AcademicSeedReferenceError } from './seed/academic-plan-references';
export type { DevSeedAcademicPlan } from './seed/dev-seed-academic-plan';
export { buildDevSeedPlan, DEV_SEED_ISSUER, type DevSeedPlan } from './seed/dev-seed-plan';
export type { SeedCounts } from './seed/seed-dev-data';
export { openTestDatabase, type TestDatabase } from './testing/integration-fixtures';
export { type SeedScenarioSource, writeSeedScenario } from './testing/seed-scenario-writer';
