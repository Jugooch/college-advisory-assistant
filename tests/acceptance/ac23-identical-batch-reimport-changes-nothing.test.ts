/**
 * @file Acceptance: delivering the same roster batch a second time changes nothing.
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

const PAYLOAD = rosterPayload({
  batchId: 'ac23-batch-0001',
  rows: [
    buildRosterRow({ sourceStudentId: 'SYN-002301', recordVersion: 1 }),
    buildRosterRow({ sourceStudentId: 'SYN-002302', recordVersion: 1 }),
  ],
});

describe('AC23 identical batch re-import', () => {
  it('publishes the batch the first time it arrives', async () => {
    const { job, store } = createRosterHarness();

    const result = await job.handle(PAYLOAD);

    expect(result).toEqual({
      outcome: 'PUBLISHED',
      batchId: 'ac23-batch-0001',
      counts: { recordCount: 2, validCount: 2, quarantinedCount: 0 },
    });
    expect(storedStudent(store, 'SYN-002301')).toEqual({
      sourceStudentId: 'SYN-002301',
      recordVersion: 1,
      isDeleted: false,
    });
  });

  it('reports ALREADY_IMPORTED and leaves every stored record unchanged the second time', async () => {
    const { job, store } = createRosterHarness();
    await job.handle(PAYLOAD);
    const before = snapshotStore(store);

    const result = await job.handle(PAYLOAD);

    expect(result).toEqual({
      outcome: 'ALREADY_IMPORTED',
      batchId: 'ac23-batch-0001',
      counts: { recordCount: 2, validCount: 2, quarantinedCount: 0 },
    });
    expect(snapshotStore(store)).toEqual(before);
    expect(store.batches.size).toBe(1);
  });
});
