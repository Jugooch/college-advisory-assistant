/**
 * @file Tests for `FULL` roster batches in the roster import job (#30), against in-memory fakes.
 * The deletions themselves happen in `RosterRepository.publishRoster` and are covered by its
 * integration tests; these prove what the job sends and how it reports the reconciliation.
 */
import { describe, expect, it, vi } from 'vitest';

import type { ImportBatchRepository, RosterRepository } from '@caa/db';
import { type ImportBatch, ImportOperation, type RosterRowInput } from '@caa/domain';
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
const SOURCE_ID = 'demo-sis';
const LATE = '2026-09-25T05:30:00.000-05:00';
const INVALID_ROW = { sourceStudentId: '', recordVersion: 1, isDeleted: false };

/**
 * Builds the job over fakes that record each batch by ID; published batches count as newest.
 *
 * @returns The job and spies on the two roster writes.
 */
function setUp() {
  const published: ImportBatch[] = [];
  const recorded = new Map<string, ImportBatch>();
  const importBatches: ImportBatchRepository = {
    findByKey: (_tenantId, _sourceId, batchId) => Promise.resolve(recorded.get(batchId) ?? null),
    findLatestPublishedEffectiveAt: () => {
      const times = published.map((batch) => Date.parse(batch.sourceEffectiveAt));
      return Promise.resolve(
        times.length === 0 ? null : new Date(Math.max(...times)).toISOString(),
      );
    },
  };
  const publishRoster = vi.fn<RosterRepository['publishRoster']>((_tenantId, { batch }) => {
    recorded.set(batch.batchId, batch);
    published.push(batch);
    return Promise.resolve();
  });
  const quarantineRoster = vi.fn<RosterRepository['quarantineRoster']>((_tenantId, { batch }) => {
    recorded.set(batch.batchId, batch);
    return Promise.resolve();
  });
  const logger = { info: vi.fn(), warn: vi.fn() };
  const job = createImportRosterJob({
    importBatches,
    rosters: { publishRoster, quarantineRoster },
    logger,
    maxInvalidRowPercent: 25,
  });
  return { job, publishRoster, quarantineRoster, logger };
}

/**
 * Builds a FULL payload for tenant A.
 *
 * @param options - Batch options.
 * @returns The payload.
 */
function fullPayload(options: RosterBatchOptions = {}) {
  const document = buildRosterBatch({ ...options, operation: ImportOperation.Full });
  return { tenantId: TENANT_ID, sourceId: SOURCE_ID, document };
}

/**
 * Builds a FULL payload whose checksum and count match rows that may be invalid.
 *
 * @param rows - Raw rows.
 * @returns The payload.
 */
function fullPayloadWithRows(rows: readonly RosterRowInput[]) {
  const batch = buildImportBatch({
    operation: ImportOperation.Full,
    checksum: computeRosterChecksum(rows),
    recordCount: rows.length,
  });
  return { tenantId: TENANT_ID, sourceId: SOURCE_ID, document: { batch, rows } };
}

describe('import-roster job with FULL batches', () => {
  it('publishes a complete FULL batch and reports the reconciliation as completed', async () => {
    const { job, publishRoster } = setUp();

    const result = await job.handle(fullPayload());

    expect(result).toEqual({
      outcome: 'PUBLISHED',
      batchId: 'synthetic-batch-0001',
      counts: { recordCount: 3, validCount: 3, quarantinedCount: 0 },
      reconciliation: 'COMPLETED',
    });
    const [[tenantId, publication]] = publishRoster.mock.calls as [
      Parameters<RosterRepository['publishRoster']>,
    ];
    expect(tenantId).toBe(TENANT_ID);
    expect(publication.batch.operation).toBe(ImportOperation.Full);
    expect(publication.quarantined).toEqual([]);
    expect(publication.shouldReconcileMissing).toBe(true);
  });

  it('publishes a FULL batch with a quarantined row but reports the reconciliation skipped', async () => {
    const { job, publishRoster } = setUp();
    const valid = [1, 2, 3].map((seed) => buildRosterRow({}, seed));

    const result = await job.handle(fullPayloadWithRows([...valid, INVALID_ROW]));

    expect(result).toMatchObject({
      outcome: 'PUBLISHED',
      counts: { validCount: 3, quarantinedCount: 1 },
      reconciliation: 'SKIPPED_QUARANTINED_ROWS',
    });
    expect(
      publishRoster.mock.calls.map(([, { shouldReconcileMissing }]) => shouldReconcileMissing),
    ).toEqual([false]);
  });

  it('publishes an empty FULL batch but reports the reconciliation skipped', async () => {
    const { job, publishRoster } = setUp();

    const result = await job.handle(fullPayload({ rows: [] }));

    expect(result).toMatchObject({
      outcome: 'PUBLISHED',
      counts: { recordCount: 0 },
      reconciliation: 'SKIPPED_EMPTY_SNAPSHOT',
    });
    expect(
      publishRoster.mock.calls.map(([, { shouldReconcileMissing }]) => shouldReconcileMissing),
    ).toEqual([false]);
  });

  it('quarantines a FULL batch above the threshold and reconciles nothing', async () => {
    const { job, publishRoster, quarantineRoster } = setUp();

    const result = await job.handle(fullPayloadWithRows([buildRosterRow({}, 1), INVALID_ROW]));

    expect(result).toMatchObject({ outcome: 'QUARANTINED' });
    expect(result).not.toHaveProperty('reconciliation');
    expect(quarantineRoster).toHaveBeenCalledTimes(1);
    expect(publishRoster).not.toHaveBeenCalled();
  });

  it('rejects a late, older FULL batch as stale without publishing it', async () => {
    const { job, publishRoster } = setUp();
    await job.handle(fullPayload({ sourceEffectiveAt: LATE }));

    const result = await job.handle(
      fullPayload({ batchId: 'b0', sourceEffectiveAt: '2026-09-24T05:30:00.000-05:00' }),
    );

    expect(result).toMatchObject({ outcome: 'REJECTED_STALE' });
    expect(result).not.toHaveProperty('reconciliation');
    expect(publishRoster).toHaveBeenCalledTimes(1);
  });

  it('reports a replayed FULL batch as already imported without reconciling again', async () => {
    const { job, publishRoster } = setUp();
    await job.handle(fullPayload());

    const result = await job.handle(fullPayload());

    expect(result).toMatchObject({ outcome: 'ALREADY_IMPORTED' });
    expect(result).not.toHaveProperty('reconciliation');
    expect(publishRoster).toHaveBeenCalledTimes(1);
  });

  it('logs the reconciliation with opaque IDs and counts only', async () => {
    const { job, logger } = setUp();

    await job.handle(fullPayload());

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'PUBLISHED', reconciliation: 'COMPLETED' }),
      'roster import finished',
    );
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('SYN-');
  });
});
