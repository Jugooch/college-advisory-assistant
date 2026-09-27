/**
 * @file Runs the real roster import job over QA-owned in-memory repositories, so acceptance cases
 * can observe what each batch published. The job is reached only through `@caa/worker/testing`.
 * Its in-memory fakes deliberately don't reuse the worker team's fakes, so the acceptance oracle
 * stays independent of the code under test (docs/standards/07-testing.md, Acceptance tests).
 * @module @caa/tests/support/roster-harness
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import type { ImportBatchRepository, QuarantinedRow, RosterRepository } from '@caa/db';
import { type ImportBatch, ImportOperation, type RosterRow } from '@caa/domain';
import { buildRosterBatch, type RosterBatchOptions, SYNTHETIC_TENANTS } from '@caa/test-kit';
import { createImportRosterJob, type ImportRosterJob } from '@caa/worker/testing';

/** Source every acceptance batch comes from. */
export const ROSTER_SOURCE_ID = 'demo-sis';

/** A recorded batch and the status it was recorded with. */
export interface RecordedBatch {
  readonly batch: ImportBatch;
  readonly status: 'PUBLISHED' | 'QUARANTINED';
}

/** Everything the fake repositories have stored. */
export interface RosterStore {
  /** Recorded batches by `tenant|source|batchId`. */
  readonly batches: Map<string, RecordedBatch>;
  /** Stored student rows by `tenant|sourceStudentId`, tombstones included. */
  readonly students: Map<string, RosterRow>;
  readonly quarantined: QuarantinedRow[];
}

/** The job under test with the store it writes to. */
export interface RosterHarness {
  readonly job: ImportRosterJob;
  readonly store: RosterStore;
}

/**
 * Creates the import batch repository over the store.
 *
 * @param store - Backing data.
 * @returns An {@link ImportBatchRepository}.
 */
function createImportBatches(store: RosterStore): ImportBatchRepository {
  return {
    findByKey: (tenantId, sourceId, batchId) =>
      Promise.resolve(store.batches.get(`${tenantId}|${sourceId}|${batchId}`)?.batch ?? null),
    findLatestPublishedEffectiveAt: (tenantId, sourceId) => {
      const times = [...store.batches.values()]
        .filter(({ batch, status }) => status === 'PUBLISHED' && batch.tenantId === tenantId)
        .filter(({ batch }) => batch.sourceId === sourceId)
        .map(({ batch }) => Date.parse(batch.sourceEffectiveAt));
      return Promise.resolve(
        times.length === 0 ? null : new Date(Math.max(...times)).toISOString(),
      );
    },
  };
}

/**
 * Creates the roster repository over the store. A batch key is recorded once; a published row
 * replaces the stored row with the same source ID, and a tombstone is stored as deleted. Students
 * missing from a batch are left alone. It applies no ordering rule of its own, so any protection
 * against late batches is the job's.
 *
 * @param store - Backing data.
 * @returns A {@link RosterRepository}.
 */
function createRosters(store: RosterStore): RosterRepository {
  const record = (batch: ImportBatch, status: RecordedBatch['status']): void => {
    const key = `${batch.tenantId}|${batch.sourceId}|${batch.batchId}`;
    if (store.batches.has(key)) throw new Error('duplicate batch key');
    store.batches.set(key, { batch, status });
  };
  return {
    publishRoster: (tenantId, { batch, rows, quarantined }) => {
      record(batch, 'PUBLISHED');
      rows.forEach((row) => store.students.set(`${tenantId}|${row.sourceStudentId}`, row));
      store.quarantined.push(...quarantined);
      return Promise.resolve();
    },
    quarantineRoster: (_tenantId, { batch, quarantined }) => {
      record(batch, 'QUARANTINED');
      store.quarantined.push(...quarantined);
      return Promise.resolve();
    },
  };
}

/**
 * Builds the roster import job over an empty store, with a 25 percent invalid-row threshold and a
 * logger that discards everything.
 *
 * @returns The job and its store.
 */
export function createRosterHarness(): RosterHarness {
  const store: RosterStore = { batches: new Map(), students: new Map(), quarantined: [] };
  const logger = { info: (): void => undefined, warn: (): void => undefined };
  const job = createImportRosterJob({
    importBatches: createImportBatches(store),
    rosters: createRosters(store),
    logger,
    maxInvalidRowPercent: 25,
  });
  return { job, store };
}

/**
 * Builds a job payload for tenant A from a synthetic DELTA roster batch.
 *
 * @param options - Batch options; `operation` defaults to DELTA.
 * @returns The payload, with the document exactly as a source would send it.
 */
export function rosterPayload(options: RosterBatchOptions): {
  tenantId: string;
  sourceId: string;
  document: unknown;
} {
  const document = buildRosterBatch({
    operation: ImportOperation.Delta,
    sourceId: ROSTER_SOURCE_ID,
    ...options,
  });
  return { tenantId: SYNTHETIC_TENANTS.a.id, sourceId: ROSTER_SOURCE_ID, document };
}

/**
 * Reads a stored student row in tenant A.
 *
 * @param store - Store to read.
 * @param sourceStudentId - Source-system student ID.
 * @returns The stored row, or undefined when the student was never published.
 */
export function storedStudent(store: RosterStore, sourceStudentId: string): RosterRow | undefined {
  return store.students.get(`${SYNTHETIC_TENANTS.a.id}|${sourceStudentId}`);
}

/**
 * Copies everything in the store into plain values, so two moments can be compared.
 *
 * @param store - Store to copy.
 * @returns Batches, students, and quarantined rows as sorted entries.
 */
export function snapshotStore(store: RosterStore): unknown {
  return {
    batches: [...store.batches.entries()].sort(([a], [b]) => a.localeCompare(b)),
    students: [...store.students.entries()].sort(([a], [b]) => a.localeCompare(b)),
    quarantined: [...store.quarantined],
  };
}
