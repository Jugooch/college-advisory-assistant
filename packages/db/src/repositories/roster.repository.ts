/**
 * @file Atomic publication of roster import batches: batch record, students, and quarantine.
 * @module @caa/db/repositories/roster
 * @requirement FR-03
 * @requirement NFR-04
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { lte, sql } from 'drizzle-orm';

import {
  type ImportBatch,
  ImportBatchStatus,
  type InstitutionId,
  type RosterRow,
} from '@caa/domain';

import type { Database } from '../client';
import { importBatchTable } from '../tables/import-batch.table';
import { importQuarantineTable } from '../tables/import-quarantine.table';
import { studentTable } from '../tables/student.table';

/** Handle passed to a `db.transaction` callback. */
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** PERF: keeps each multi-row insert well under PostgreSQL's 65,535 bind-parameter limit. */
const INSERT_CHUNK_SIZE = 1000;

/** A source row that failed validation and is set aside instead of published. */
export interface QuarantinedRow {
  /** Zero-based position of the row in the batch. */
  readonly rowIndex: number;
  /** Source record ID when it could be read, otherwise null. */
  readonly sourceRecordId: string | null;
  /** Short machine-readable reason. Never contains row values. */
  readonly reason: string;
}

/** A validated batch ready to publish. */
export interface RosterPublication {
  readonly batch: ImportBatch;
  /** Valid rows, each `sourceStudentId` at most once. */
  readonly rows: readonly RosterRow[];
  readonly quarantined: readonly QuarantinedRow[];
}

/** A batch rejected as a whole. */
export interface RosterRejection {
  readonly batch: ImportBatch;
  readonly quarantined: readonly QuarantinedRow[];
}

/** Writes roster batches. Each method is one transaction: all of it is stored, or none of it. */
export interface RosterRepository {
  /**
   * Publishes a batch: records it as PUBLISHED, upserts its students by source ID, applies
   * tombstones, and records its quarantined rows. Students missing from the batch are unchanged.
   *
   * @param tenantId - Tenant the batch belongs to; must match `batch.tenantId`.
   * @param publication - Envelope, valid rows, and quarantined rows.
   * @returns Resolves once the transaction commits.
   * @throws {Error} When the tenant doesn't match, the batch key was already recorded, or any
   *   write fails. Nothing is stored in that case.
   */
  publishRoster(tenantId: InstitutionId, publication: RosterPublication): Promise<void>;

  /**
   * Records a batch as QUARANTINED with its rejected rows. No student is changed.
   *
   * @param tenantId - Tenant the batch belongs to; must match `batch.tenantId`.
   * @param rejection - Envelope and quarantined rows.
   * @returns Resolves once the transaction commits.
   * @throws {Error} When the tenant doesn't match, the batch key was already recorded, or any
   *   write fails. Nothing is stored in that case.
   */
  quarantineRoster(tenantId: InstitutionId, rejection: RosterRejection): Promise<void>;
}

/**
 * Splits a list into chunks of at most {@link INSERT_CHUNK_SIZE}.
 *
 * @param items - Items to split.
 * @returns The chunks, in order.
 */
function chunk<T>(items: readonly T[]): (readonly T[])[] {
  const chunks: (readonly T[])[] = [];
  for (let start = 0; start < items.length; start += INSERT_CHUNK_SIZE) {
    chunks.push(items.slice(start, start + INSERT_CHUNK_SIZE));
  }
  return chunks;
}

/**
 * Inserts the batch record.
 *
 * @param tx - Open transaction.
 * @param batch - Envelope to record.
 * @param outcome - Status and number of quarantined rows.
 * @returns The internal ID of the new batch record.
 */
async function insertBatch(
  tx: Transaction,
  batch: ImportBatch,
  outcome: { readonly status: ImportBatchStatus; readonly rejectedCount: number },
): Promise<string> {
  const inserted = await tx
    .insert(importBatchTable)
    .values({
      tenantId: batch.tenantId,
      sourceId: batch.sourceId,
      schemaVersion: batch.schemaVersion,
      batchId: batch.batchId,
      extractedAt: new Date(batch.extractedAt),
      sourceEffectiveAt: new Date(batch.sourceEffectiveAt),
      checksum: batch.checksum,
      recordCount: batch.recordCount,
      operation: batch.operation,
      status: outcome.status,
      rejectedCount: outcome.rejectedCount,
    })
    .returning({ id: importBatchTable.id });
  const record = inserted[0];
  if (!record) {
    throw new Error('Inserting the import batch returned no row');
  }
  return record.id;
}

/**
 * Upserts students by (tenant, source student ID), including tombstones.
 *
 * @param tx - Open transaction.
 * @param batch - Envelope the rows belong to.
 * @param rows - Valid rows.
 */
async function upsertStudents(
  tx: Transaction,
  batch: ImportBatch,
  rows: readonly RosterRow[],
): Promise<void> {
  const sourceEffectiveAt = new Date(batch.sourceEffectiveAt);
  for (const part of chunk(rows)) {
    await tx
      .insert(studentTable)
      .values(
        part.map((row) => ({
          tenantId: batch.tenantId,
          sourceStudentId: row.sourceStudentId,
          recordVersion: row.recordVersion,
          sourceEffectiveAt,
          // NOTE: a tombstone for an unknown student is stored as deleted, so a late, older
          // batch can't bring it back.
          isDeleted: row.isDeleted,
        })),
      )
      .onConflictDoUpdate({
        target: [studentTable.tenantId, studentTable.sourceStudentId],
        set: {
          recordVersion: sql`excluded.record_version`,
          sourceEffectiveAt: sql`excluded.source_effective_at`,
          isDeleted: sql`excluded.is_deleted`,
        },
        // SAFETY: a late, older batch must never replace newer source data.
        setWhere: lte(studentTable.sourceEffectiveAt, sourceEffectiveAt),
      });
  }
}

/**
 * Records quarantined rows against a batch.
 *
 * @param tx - Open transaction.
 * @param batch - Envelope the rows belong to.
 * @param options - Internal batch ID and the rows to record.
 */
async function insertQuarantined(
  tx: Transaction,
  batch: ImportBatch,
  options: { readonly importBatchId: string; readonly rows: readonly QuarantinedRow[] },
): Promise<void> {
  for (const part of chunk(options.rows)) {
    await tx.insert(importQuarantineTable).values(
      part.map((row) => ({
        tenantId: batch.tenantId,
        importBatchId: options.importBatchId,
        rowIndex: row.rowIndex,
        sourceRecordId: row.sourceRecordId,
        reason: row.reason,
      })),
    );
  }
}

/**
 * Rejects a batch whose envelope names a different tenant than the caller's.
 *
 * @param tenantId - Tenant the caller is acting for.
 * @param batch - Envelope to check.
 * @throws {Error} When the tenants differ.
 */
function assertSameTenant(tenantId: InstitutionId, batch: ImportBatch): void {
  // SECURITY: a batch is only ever written into the tenant the caller is acting for.
  if (batch.tenantId !== tenantId) {
    throw new Error('Import batch tenant does not match the requested tenant');
  }
}

/**
 * Creates the roster repository.
 *
 * @param db - Typed database handle.
 * @returns A {@link RosterRepository}.
 */
export function createRosterRepository(db: Database): RosterRepository {
  return {
    async publishRoster(tenantId, { batch, rows, quarantined }) {
      assertSameTenant(tenantId, batch);
      await db.transaction(async (tx) => {
        const importBatchId = await insertBatch(tx, batch, {
          status: ImportBatchStatus.Published,
          rejectedCount: quarantined.length,
        });
        await upsertStudents(tx, batch, rows);
        await insertQuarantined(tx, batch, { importBatchId, rows: quarantined });
      });
    },

    async quarantineRoster(tenantId, { batch, quarantined }) {
      assertSameTenant(tenantId, batch);
      await db.transaction(async (tx) => {
        const importBatchId = await insertBatch(tx, batch, {
          status: ImportBatchStatus.Quarantined,
          rejectedCount: quarantined.length,
        });
        await insertQuarantined(tx, batch, { importBatchId, rows: quarantined });
      });
    },
  };
}
