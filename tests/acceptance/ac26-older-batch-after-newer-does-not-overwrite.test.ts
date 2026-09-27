/**
 * @file Acceptance: an older roster batch that arrives after a newer one is refused and does not
 * overwrite the newer data.
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

const NEWER = rosterPayload({
  batchId: 'ac26-batch-0002',
  extractedAt: '2026-09-25T06:00:00.000-05:00',
  sourceEffectiveAt: '2026-09-25T05:30:00.000-05:00',
  rows: [
    buildRosterRow({ sourceStudentId: 'SYN-002601', recordVersion: 2, isDeleted: true }),
    buildRosterRow({ sourceStudentId: 'SYN-002602', recordVersion: 2 }),
  ],
});

const OLDER_ARRIVING_LATE = rosterPayload({
  batchId: 'ac26-batch-0001',
  extractedAt: '2026-09-24T06:00:00.000-05:00',
  sourceEffectiveAt: '2026-09-24T05:30:00.000-05:00',
  rows: [
    buildRosterRow({ sourceStudentId: 'SYN-002601', recordVersion: 1 }),
    buildRosterRow({ sourceStudentId: 'SYN-002602', recordVersion: 1 }),
    buildRosterRow({ sourceStudentId: 'SYN-002603', recordVersion: 1 }),
  ],
});

describe('AC26 older batch arriving after a newer one', () => {
  it('refuses the older batch as stale', async () => {
    const { job } = createRosterHarness();
    await job.handle(NEWER);

    const result = await job.handle(OLDER_ARRIVING_LATE);

    expect(result).toEqual({
      outcome: 'REJECTED_STALE',
      batchId: 'ac26-batch-0001',
      counts: { recordCount: 3, validCount: 3, quarantinedCount: 0 },
    });
  });

  it('keeps the newer data, including its tombstone, and adds nothing from the older batch', async () => {
    const { job, store } = createRosterHarness();
    await job.handle(NEWER);
    const before = snapshotStore(store);

    await job.handle(OLDER_ARRIVING_LATE);

    expect(snapshotStore(store)).toEqual(before);
    expect(storedStudent(store, 'SYN-002601')).toEqual({
      sourceStudentId: 'SYN-002601',
      recordVersion: 2,
      isDeleted: true,
    });
    expect(storedStudent(store, 'SYN-002602')).toEqual({
      sourceStudentId: 'SYN-002602',
      recordVersion: 2,
      isDeleted: false,
    });
    expect(storedStudent(store, 'SYN-002603')).toBeUndefined();
  });
});
