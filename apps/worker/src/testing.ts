/**
 * @file Test-only entry point (`@caa/worker/testing`) that exposes jobs to cross-package tests.
 * @module @caa/worker/testing
 * @see docs/standards/01-repository-structure.md
 *
 * For tests only. The production bundle is built from `main.ts` alone and never includes this
 * file, so nothing here is shipped or run by the deployed worker.
 */
export {
  createImportRosterJob,
  IMPORT_ROSTER_JOB_NAME,
  type ImportRosterCounts,
  type ImportRosterJob,
  type ImportRosterJobDependencies,
  type ImportRosterOutcome,
  type ImportRosterPayload,
  type ImportRosterResult,
} from './jobs/import-roster.job';
export type { JobDefinition } from './shared/job-definition';
export type { JobLogger } from './shared/job-logger';
