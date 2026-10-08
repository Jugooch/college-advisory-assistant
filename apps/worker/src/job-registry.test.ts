/**
 * @file Tests for the job registry.
 */
import { describe, expect, it } from 'vitest';

import type { ImportBatchRepository, RosterRepository } from '@caa/db';

import { createJobRegistry } from './job-registry';

describe('createJobRegistry', () => {
  it('registers the roster import and turn-log retention jobs', () => {
    const unused = async (): Promise<never> => Promise.reject(new Error('not called'));
    const importBatches: ImportBatchRepository = {
      findByKey: unused,
      findLatestPublishedEffectiveAt: unused,
    };
    const rosters: RosterRepository = { publishRoster: unused, quarantineRoster: unused };
    const logger = { info: () => undefined, warn: () => undefined };

    const jobs = createJobRegistry({
      importBatches,
      rosters,
      turnLog: { pruneBefore: unused },
      logger,
      now: () => new Date('2026-10-08T12:00:00.000Z'),
      turnLogRetentionMinutes: 60,
      maxInvalidRowPercent: 5,
    });

    expect(jobs.map((job) => job.name)).toEqual(['import-roster', 'prune-turn-log']);
  });
});
