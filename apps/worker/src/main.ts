/**
 * @file Worker entry point. Builds the dependencies and the registered jobs.
 * @module @caa/worker/main
 */
import pino from 'pino';

import {
  createDatabase,
  createImportBatchRepository,
  createRosterRepository,
  createStudentTurnLogRepository,
} from '@caa/db';

import { createJobRegistry } from './job-registry';
import { loadWorkerEnv } from './shared/worker-env';

const env = loadWorkerEnv(process.env);
const logger = pino({ name: 'worker' });
// NOTE: the pool connects lazily, on the first query a job makes.
const db = createDatabase(env.DATABASE_URL);

const jobs = createJobRegistry({
  importBatches: createImportBatchRepository(db),
  rosters: createRosterRepository(db),
  turnLog: createStudentTurnLogRepository(db),
  logger,
  now: () => new Date(),
  turnLogRetentionMinutes: env.TURN_LOG_RETENTION_MINUTES,
  maxInvalidRowPercent: env.ROSTER_MAX_INVALID_ROW_PERCENT,
});

logger.info({ jobCount: jobs.length }, 'worker started');
