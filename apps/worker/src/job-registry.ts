/**
 * @file Every job the worker runs. Add each new `*.job.ts` export here.
 * @module @caa/worker/job-registry
 */
import { createImportRosterJob, type ImportRosterJobDependencies } from './jobs/import-roster.job';
import { createPruneTurnLogJob, type PruneTurnLogJobDependencies } from './jobs/prune-turn-log.job';
import type { JobDefinition } from './shared/job-definition';

/** Everything the registered jobs need. Constructed only in `main.ts`. */
export type WorkerDependencies = ImportRosterJobDependencies & PruneTurnLogJobDependencies;

/**
 * Builds the registered jobs.
 *
 * @param dependencies - Repositories, logger, and job settings.
 * @returns One definition per job.
 */
export function createJobRegistry(
  dependencies: WorkerDependencies,
): readonly JobDefinition<unknown>[] {
  return [createImportRosterJob(dependencies), createPruneTurnLogJob(dependencies)];
}
