/**
 * @file Acceptance: a DELTA batch that leaves a student out does not delete them; a tombstone row
 * does.
 * @requirement FR-03
 * @requirement T02
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { describe, expect, it } from 'vitest';

import { buildRosterRow } from '@caa/test-kit';

import { createRosterHarness, rosterPayload, storedStudent } from '../support/roster-harness';

const INITIAL = rosterPayload({
  batchId: 'ac25-batch-0001',
  sourceEffectiveAt: '2026-09-23T05:30:00.000-05:00',
  rows: [
    buildRosterRow({ sourceStudentId: 'SYN-002501', recordVersion: 1 }),
    buildRosterRow({ sourceStudentId: 'SYN-002502', recordVersion: 1 }),
  ],
});

const OMITS_SECOND = rosterPayload({
  batchId: 'ac25-batch-0002',
  sourceEffectiveAt: '2026-09-24T05:30:00.000-05:00',
  rows: [buildRosterRow({ sourceStudentId: 'SYN-002501', recordVersion: 2 })],
});

const TOMBSTONES_SECOND = rosterPayload({
  batchId: 'ac25-batch-0003',
  sourceEffectiveAt: '2026-09-25T05:30:00.000-05:00',
  rows: [buildRosterRow({ sourceStudentId: 'SYN-002502', recordVersion: 2, isDeleted: true })],
});

describe('AC25 DELTA omission versus tombstone', () => {
  it('keeps a student that a later DELTA batch leaves out', async () => {
    const { job, store } = createRosterHarness();
    await job.handle(INITIAL);

    const result = await job.handle(OMITS_SECOND);

    expect(result).toMatchObject({ outcome: 'PUBLISHED', batchId: 'ac25-batch-0002' });
    expect(storedStudent(store, 'SYN-002502')).toEqual({
      sourceStudentId: 'SYN-002502',
      recordVersion: 1,
      isDeleted: false,
    });
  });

  it('deletes a student when a later DELTA batch carries their tombstone', async () => {
    const { job, store } = createRosterHarness();
    await job.handle(INITIAL);
    await job.handle(OMITS_SECOND);

    const result = await job.handle(TOMBSTONES_SECOND);

    expect(result).toEqual({
      outcome: 'PUBLISHED',
      batchId: 'ac25-batch-0003',
      counts: { recordCount: 1, validCount: 1, quarantinedCount: 0 },
    });
    expect(storedStudent(store, 'SYN-002502')).toEqual({
      sourceStudentId: 'SYN-002502',
      recordVersion: 2,
      isDeleted: true,
    });
    expect(storedStudent(store, 'SYN-002501')).toEqual({
      sourceStudentId: 'SYN-002501',
      recordVersion: 2,
      isDeleted: false,
    });
  });
});
