/**
 * @file Tests for the job registry.
 */
import { describe, expect, it } from 'vitest';

import type { ImportBatchRepository, RosterRepository } from '@caa/db';

import { createJobRegistry } from './job-registry';

describe('createJobRegistry', () => {
  it('registers the roster import job', () => {
    const unused = async (): Promise<never> => Promise.reject(new Error('not called'));
    const importBatches: ImportBatchRepository = {
      findByKey: unused,
      findLatestPublishedEffectiveAt: unused,
    };
    const rosters: RosterRepository = { publishRoster: unused, quarantineRoster: unused };
    const logger = { info: () => undefined, warn: () => undefined };

    const jobs = createJobRegistry({ importBatches, rosters, logger, maxInvalidRowPercent: 5 });

    expect(jobs.map((job) => job.name)).toEqual(['import-roster']);
  });
});
