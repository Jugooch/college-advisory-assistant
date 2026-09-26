/**
 * @file Every job the worker runs. Add each new `*.job.ts` export here.
 * @module @caa/worker/job-registry
 */
import type { JobDefinition } from './shared/job-definition';

/** Registered jobs. Empty until the first import adapter is qualified. */
export const JOB_REGISTRY: readonly JobDefinition<unknown>[] = [];
