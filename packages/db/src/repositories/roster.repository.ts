/**
 * @file Atomic publication of roster import batches: batch record, students, and quarantine.
 * @module @caa/db/repositories/roster
 * @requirement FR-03
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { and, eq, lt, sql } from 'drizzle-orm';

import {
  type ImportBatch,
  ImportBatchStatus,
  ImportOperation,
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
  /** Valid rows, each `sourceStudentId` at most once (enforced before writing). */
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
   * tombstones, and records its quarantined rows. Students missing from a `DELTA` are unchanged.
   *
   * A non-empty `FULL` batch with no quarantined rows is also reconciled in the same
   * transaction: every non-deleted student of the tenant whose `sourceId` is the batch's, whose
   * source time is older than the batch's, and who is missing from it, is marked deleted. Any
   * other `FULL` batch is published without deleting anyone (see {@link isReconcilable}).
   *
   * @param tenantId - Tenant the batch belongs to; must match `batch.tenantId`.
   * @param publication - Envelope, valid rows, and quarantined rows.
   * @returns Resolves once the transaction commits.
   * @throws {Error} When the tenant doesn't match, two rows share a `sourceStudentId`, the batch
   *   key was already recorded, or any write fails. Nothing is stored in that case.
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

/** Upsert condition: true when the incoming student row may replace the stored one. */
// SAFETY: a late, older batch must not replace newer truth (docs/planning/09, Adapter envelope).
// The later `source_effective_at` wins. At an equal time, `record_version` breaks the tie when
// both sides have one, so a lower version can't undo a tombstone. When either version is null
// the source gave no order, so arrival order decides; the importer refuses older batches.
const INCOMING_SUPERSEDES_STORED = sql`${studentTable.sourceEffectiveAt} < excluded.source_effective_at
  OR (${studentTable.sourceEffectiveAt} = excluded.source_effective_at
    AND (${studentTable.recordVersion} IS NULL
      OR excluded.record_version IS NULL
      OR excluded.record_version >= ${studentTable.recordVersion}))`;

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
          sourceId: batch.sourceId,
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
          sourceId: sql`excluded.source_id`,
          recordVersion: sql`excluded.record_version`,
          sourceEffectiveAt: sql`excluded.source_effective_at`,
          isDeleted: sql`excluded.is_deleted`,
        },
        setWhere: INCOMING_SUPERSEDES_STORED,
      });
  }
}

/**
 * Tells whether a published batch is a complete snapshot whose omissions are removals.
 *
 * @param batch - Envelope being published.
 * @param rows - Its valid rows.
 * @param quarantined - Its quarantined rows.
 * @returns True only for a non-empty `FULL` batch with no quarantined row.
 */
export function isReconcilable(
  batch: ImportBatch,
  rows: readonly RosterRow[],
  quarantined: readonly QuarantinedRow[],
): boolean {
  // SAFETY: missing from a DELTA is not deletion (docs/planning/09, Adapter envelope). A FULL
  // batch with a quarantined row is incomplete, and an empty one is far more likely a failed
  // extract than a source with no students, so neither deletes anyone.
  return batch.operation === ImportOperation.Full && quarantined.length === 0 && rows.length > 0;
}

/**
 * Marks deleted every student a complete `FULL` batch no longer contains. Runs after the upsert
 * in the same transaction.
 *
 * @param tx - Open transaction.
 * @param batch - A `FULL` envelope whose rows all passed validation.
 * @param rows - All of its rows.
 */
async function reconcileFullSnapshot(
  tx: Transaction,
  batch: ImportBatch,
  rows: readonly RosterRow[],
): Promise<void> {
  const sourceEffectiveAt = new Date(batch.sourceEffectiveAt);
  const presentIds = rows.map((row) => row.sourceStudentId);
  await tx
    .update(studentTable)
    // NOTE: the batch time is recorded so a late, older DELTA can't bring the student back.
    .set({ isDeleted: true, sourceEffectiveAt })
    .where(
      and(
        // SECURITY: only this tenant's students, and only those this source last wrote. A student
        // with no recorded source is never reconciled.
        eq(studentTable.tenantId, batch.tenantId),
        eq(studentTable.sourceId, batch.sourceId),
        eq(studentTable.isDeleted, false),
        // SAFETY: a late, older FULL batch can't delete a student that newer truth changed.
        lt(studentTable.sourceEffectiveAt, sourceEffectiveAt),
        // PERF: one array parameter, whatever the batch size.
        sql`NOT (${studentTable.sourceStudentId} = ANY(${sql.param(presentIds)}::text[]))`,
      ),
    );
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
 * Rejects rows that name the same source student twice, before anything is written.
 *
 * @param rows - Valid rows of one batch.
 * @throws {Error} When two rows share a `sourceStudentId`. The message names row positions only.
 */
function assertUniqueSourceStudentIds(rows: readonly RosterRow[]): void {
  const firstIndexById = new Map<string, number>();
  rows.forEach((row, index) => {
    const firstIndex = firstIndexById.get(row.sourceStudentId);
    // SAFETY: otherwise the outcome would depend on chunk boundaries (an error inside one chunk,
    // silent last-write-wins across chunks).
    if (firstIndex !== undefined) {
      // SECURITY: the message names row positions only, never a student identifier.
      throw new Error(
        `Roster rows ${String(firstIndex)} and ${String(index)} have the same sourceStudentId`,
      );
    }
    firstIndexById.set(row.sourceStudentId, index);
  });
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
      assertUniqueSourceStudentIds(rows);
      await db.transaction(async (tx) => {
        const importBatchId = await insertBatch(tx, batch, {
          status: ImportBatchStatus.Published,
          rejectedCount: quarantined.length,
        });
        await upsertStudents(tx, batch, rows);
        if (isReconcilable(batch, rows, quarantined)) {
          await reconcileFullSnapshot(tx, batch, rows);
        }
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
