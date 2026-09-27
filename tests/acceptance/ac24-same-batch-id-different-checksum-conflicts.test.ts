/**
 * @file Acceptance: a batch that reuses a recorded batch ID with a different checksum is a
 * CONFLICT, and nothing from it is published.
 * @requirement FR-03
 * @requirement T02
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { describe, expect, it } from 'vitest';

import { buildRosterRow } from '@caa/test-kit';

import {
  createRosterHarness,
  rosterPayload,
  snapshotStore,
  storedStudent,
} from '../support/roster-harness';

const ORIGINAL = rosterPayload({
  batchId: 'ac24-batch-0001',
  rows: [buildRosterRow({ sourceStudentId: 'SYN-002401', recordVersion: 1 })],
});

const REUSED_ID = rosterPayload({
  batchId: 'ac24-batch-0001',
  sourceEffectiveAt: '2026-09-26T05:30:00.000-05:00',
  rows: [
    buildRosterRow({ sourceStudentId: 'SYN-002401', recordVersion: 2, isDeleted: true }),
    buildRosterRow({ sourceStudentId: 'SYN-002402', recordVersion: 1 }),
  ],
});

describe('AC24 same batch ID with a different checksum', () => {
  it('reports CONFLICT for the second batch', async () => {
    const { job } = createRosterHarness();
    await job.handle(ORIGINAL);

    const result = await job.handle(REUSED_ID);

    expect(result).toEqual({
      outcome: 'CONFLICT',
      batchId: 'ac24-batch-0001',
      counts: { recordCount: 2, validCount: 2, quarantinedCount: 0 },
    });
  });

  it('publishes nothing from the conflicting batch', async () => {
    const { job, store } = createRosterHarness();
    await job.handle(ORIGINAL);
    const before = snapshotStore(store);

    await job.handle(REUSED_ID);

    expect(snapshotStore(store)).toEqual(before);
    expect(storedStudent(store, 'SYN-002401')).toEqual({
      sourceStudentId: 'SYN-002401',
      recordVersion: 1,
      isDeleted: false,
    });
    expect(storedStudent(store, 'SYN-002402')).toBeUndefined();
  });
});
