/**
 * @file Worker entry point. Starts consuming the registered jobs.
 * @module @caa/worker/main
 */
import pino from 'pino';

import { JOB_REGISTRY } from './job-registry';

const logger = pino({ name: 'worker' });

logger.info({ jobCount: JOB_REGISTRY.length }, 'worker started');
