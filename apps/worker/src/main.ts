/**
 * @file Worker entry point. Starts consuming the registered jobs.
 * @module @caa/worker/main
 */
import pino from 'pino';

import { jobRegistry } from './job-registry';

const logger = pino({ name: 'worker' });

logger.info({ jobCount: jobRegistry.length }, 'worker started');
