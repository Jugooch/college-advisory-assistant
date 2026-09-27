/**
 * @file Tests that the `@caa/worker/testing` entry point exposes the job factories.
 */
import { describe, expect, it } from 'vitest';

import * as testing from './testing';

describe('@caa/worker/testing', () => {
  it('exports the roster import job factory', () => {
    expect(typeof testing.createImportRosterJob).toBe('function');
  });

  it('builds a job under the registered queue name', () => {
    const job = testing.createImportRosterJob({
      importBatches: {} as never,
      rosters: {} as never,
      logger: { info: () => undefined, warn: () => undefined },
      maxInvalidRowPercent: 0,
    });

    expect(job.name).toBe(testing.IMPORT_ROSTER_JOB_NAME);
  });
});
