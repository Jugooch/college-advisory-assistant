/**
 * @file Tests for the roster import job against in-memory fake repositories.
 */
import { describe, expect, it, vi } from 'vitest';

import type { ImportBatchRepository, QuarantinedRow, RosterRepository } from '@caa/db';
import {
  type ImportBatch,
  ImportOperation,
  type RosterRow,
  type RosterRowInput,
} from '@caa/domain';
import {
  buildImportBatch,
  buildRosterBatch,
  buildRosterRow,
  computeRosterChecksum,
  type RosterBatchOptions,
  SYNTHETIC_TENANTS,
} from '@caa/test-kit';

import { createImportRosterJob } from './import-roster.job';

const TENANT_ID = SYNTHETIC_TENANTS.a.id;
const EARLY = '2026-09-24T05:30:00.000-05:00';
const LATE = '2026-09-25T05:30:00.000-05:00';

/**
 * Builds an in-memory stand-in for both repositories. Like the real ones, a batch key can be
 * recorded once, and a published row replaces the stored student with the same source ID.
 *
 * @returns The fakes and their stored state.
 */
function createFakeStore() {
  const batches = new Map<string, { batch: ImportBatch; status: string }>();
  const students = new Map<string, RosterRow>();
  const quarantined: QuarantinedRow[] = [];
  const record = (batch: ImportBatch, status: string): void => {
    const key = `${batch.tenantId}|${batch.sourceId}|${batch.batchId}`;
    if (batches.has(key)) throw new Error('duplicate batch key');
    batches.set(key, { batch, status });
  };
  const importBatches: ImportBatchRepository = {
    async findByKey(tenantId, sourceId, batchId) {
      return batches.get(`${tenantId}|${sourceId}|${batchId}`)?.batch ?? null;
    },
    async findLatestPublishedEffectiveAt(tenantId, sourceId) {
      const times = [...batches.values()]
        .filter(({ batch, status }) => status === 'PUBLISHED' && batch.tenantId === tenantId)
        .filter(({ batch }) => batch.sourceId === sourceId)
        .map(({ batch }) => Date.parse(batch.sourceEffectiveAt));
      return times.length === 0 ? null : new Date(Math.max(...times)).toISOString();
    },
  };
  const rosters: RosterRepository = {
    async publishRoster(_tenantId, publication) {
      record(publication.batch, 'PUBLISHED');
      publication.rows.forEach((row) => students.set(row.sourceStudentId, row));
      quarantined.push(...publication.quarantined);
    },
    async quarantineRoster(_tenantId, rejection) {
      record(rejection.batch, 'QUARANTINED');
      quarantined.push(...rejection.quarantined);
    },
  };
  return { importBatches, rosters, batches, students, quarantined };
}

/**
 * Builds the job with fresh fakes and a recording logger.
 *
 * @param maxInvalidRowPercent - Invalid-row threshold in whole percent.
 * @returns The job, the store, and the logged entries.
 */
function setUp(maxInvalidRowPercent = 25) {
  const store = createFakeStore();
  const logged: unknown[] = [];
  const logger = {
    info: (fields: unknown) => logged.push(fields),
    warn: (fields: unknown) => logged.push(fields),
  };
  const job = createImportRosterJob({ ...store, logger, maxInvalidRowPercent });
  return { job, store, logged };
}

/**
 * Builds a job payload for tenant A from a synthetic roster batch.
 *
 * @param options - Batch options; defaults to a DELTA batch.
 * @returns The payload.
 */
function payloadFor(options: RosterBatchOptions = {}) {
  const document = buildRosterBatch({ operation: ImportOperation.Delta, ...options });
  return { tenantId: TENANT_ID, sourceId: 'demo-sis', document };
}

/**
 * Builds a DELTA payload whose checksum and count match rows that may be invalid.
 *
 * @param rows - Raw rows.
 * @returns The payload.
 */
function payloadWithRows(rows: readonly RosterRowInput[]) {
  const batch = buildImportBatch({
    operation: ImportOperation.Delta,
    checksum: computeRosterChecksum(rows),
    recordCount: rows.length,
  });
  return { tenantId: TENANT_ID, sourceId: 'demo-sis', document: { batch, rows } };
}

const INVALID_ROW = { sourceStudentId: '', recordVersion: 1, isDeleted: false };

describe('import-roster job', () => {
  it('publishes a valid DELTA batch and reports its counts', async () => {
    const { job, store } = setUp();

    const result = await job.handle(payloadFor());

    expect(result).toEqual({
      outcome: 'PUBLISHED',
      batchId: 'synthetic-batch-0001',
      counts: { recordCount: 3, validCount: 3, quarantinedCount: 0 },
    });
    expect([...store.students.keys()]).toEqual(['SYN-000001', 'SYN-000002', 'SYN-000003']);
  });

  it('deletes only tombstoned students in a DELTA and leaves missing ones unchanged', async () => {
    const { job, store } = setUp();
    await job.handle(payloadFor({ sourceEffectiveAt: EARLY }));

    await job.handle(
      payloadFor({
        batchId: 'b2',
        rows: [buildRosterRow({ isDeleted: true, recordVersion: 2 }, 2)],
      }),
    );

    expect(store.students.get('SYN-000001')).toEqual(buildRosterRow({}, 1));
    expect(store.students.get('SYN-000002')?.isDeleted).toBe(true);
    expect(store.students.get('SYN-000003')).toEqual(buildRosterRow({}, 3));
  });

  it('reports a replay with the same key and checksum as already imported', async () => {
    const { job, store } = setUp();
    await job.handle(payloadFor());
    const publish = vi.spyOn(store.rosters, 'publishRoster');

    const result = await job.handle(payloadFor());

    expect(result).toMatchObject({ outcome: 'ALREADY_IMPORTED' });
    expect(publish).not.toHaveBeenCalled();
  });

  it('reports a replay with the same key and a different checksum as a conflict', async () => {
    const { job, store } = setUp();
    await job.handle(payloadFor());

    const result = await job.handle(payloadFor({ rows: [buildRosterRow({ isDeleted: true }, 1)] }));

    expect(result).toMatchObject({ outcome: 'CONFLICT' });
    expect(store.students.get('SYN-000001')?.isDeleted).toBe(false);
    expect(store.batches.size).toBe(1);
  });

  it('rejects a checksum mismatch without writing anything', async () => {
    const { job, store } = setUp();
    const payload = payloadFor();
    const document = {
      ...payload.document,
      rows: [buildRosterRow({}, 9), ...payload.document.rows.slice(1)],
    };

    const result = await job.handle({ ...payload, document });

    expect(result).toEqual({ outcome: 'REJECTED_INVALID', reason: 'checksum_mismatch' });
    expect(store.batches.size).toBe(0);
  });

  it('rejects a record count mismatch without writing anything', async () => {
    const { job, store } = setUp();
    const payload = payloadFor();
    const document = { ...payload.document, rows: payload.document.rows.slice(1) };

    const result = await job.handle({ ...payload, document });

    expect(result).toEqual({ outcome: 'REJECTED_INVALID', reason: 'record_count_mismatch' });
    expect(store.batches.size).toBe(0);
  });

  it('publishes valid rows and quarantines invalid ones at the threshold', async () => {
    const { job, store } = setUp(25);
    const valid = [1, 2, 3].map((seed) => buildRosterRow({}, seed));

    const result = await job.handle(payloadWithRows([...valid, INVALID_ROW]));

    expect(result).toMatchObject({
      outcome: 'PUBLISHED',
      counts: { recordCount: 4, validCount: 3, quarantinedCount: 1 },
    });
    expect(store.quarantined).toEqual([
      { rowIndex: 3, sourceRecordId: null, reason: 'invalid_field:sourceStudentId' },
    ]);
  });

  it('quarantines the whole batch above the threshold without changing students', async () => {
    const { job, store } = setUp(25);

    const result = await job.handle(payloadWithRows([buildRosterRow({}, 1), INVALID_ROW]));

    expect(result).toMatchObject({ outcome: 'QUARANTINED', counts: { quarantinedCount: 1 } });
    expect([...store.batches.values()].map(({ status }) => status)).toEqual(['QUARANTINED']);
    expect(store.students.size).toBe(0);
  });

  it('rejects a batch older than the newest published one, comparing instants', async () => {
    const { job, store } = setUp();
    await job.handle(payloadFor({ sourceEffectiveAt: LATE }));

    const result = await job.handle(
      payloadFor({
        batchId: 'b0',
        sourceEffectiveAt: '2026-09-25T10:00:00.000Z',
        rows: [buildRosterRow({ isDeleted: true }, 1)],
      }),
    );

    expect(result).toMatchObject({ outcome: 'REJECTED_STALE' });
    expect(store.students.get('SYN-000001')?.isDeleted).toBe(false);
  });

  it('rejects a FULL snapshot without writing anything', async () => {
    const { job, store } = setUp();

    const result = await job.handle(payloadFor({ operation: ImportOperation.Full }));

    expect(result).toMatchObject({ outcome: 'REJECTED_UNSUPPORTED' });
    expect(store.batches.size).toBe(0);
  });

  it('rejects a payload without a valid tenant', async () => {
    const { job } = setUp();

    const result = await job.handle({ ...payloadFor(), tenantId: 'not-a-uuid' });

    expect(result).toEqual({ outcome: 'REJECTED_INVALID', reason: 'invalid_job_payload' });
  });

  it('reports a concurrent delivery that recorded the key first as already imported', async () => {
    const { job, store } = setUp();
    await job.handle(payloadFor());
    vi.spyOn(store.importBatches, 'findByKey').mockResolvedValueOnce(null);

    const result = await job.handle(payloadFor());

    expect(result).toMatchObject({ outcome: 'ALREADY_IMPORTED' });
  });

  it('rethrows a write failure when the key is still unrecorded', async () => {
    const { job, store } = setUp();
    vi.spyOn(store.rosters, 'publishRoster').mockRejectedValueOnce(new Error('connection lost'));

    await expect(job.handle(payloadFor())).rejects.toThrow('connection lost');
  });

  it('logs opaque IDs and counts but never a source student ID', async () => {
    const { job, logged } = setUp();

    await job.handle(payloadWithRows([buildRosterRow({}, 1), INVALID_ROW, buildRosterRow({}, 2)]));

    expect(logged).toEqual([
      expect.objectContaining({
        tenantId: TENANT_ID,
        batchId: 'synthetic-batch-0001',
        quarantinedCount: 1,
      }),
    ]);
    expect(JSON.stringify(logged)).not.toContain('SYN-');
  });
});
