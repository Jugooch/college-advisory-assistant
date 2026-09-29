/**
 * @file The roster import rule for when a published batch may delete students by omission.
 * @module @caa/worker/shared/roster-reconciliation
 * @requirement FR-03
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import type { QuarantinedRow } from '@caa/db';
import { type ImportBatch, ImportOperation, type RosterRow } from '@caa/domain';

/**
 * What a published `FULL` batch does about students it no longer contains.
 *
 * - `COMPLETED`: the snapshot is complete, so every student of the tenant last written by this
 *   source, strictly older than the batch, and missing from it, is marked deleted. A student
 *   stored at the batch's own source time is left alone, because the source gives no order
 *   between the two.
 * - `SKIPPED_QUARANTINED_ROWS`: a row was quarantined, so the snapshot is incomplete and nobody
 *   is deleted. A quarantined row may be a student the batch still contains.
 * - `SKIPPED_EMPTY_SNAPSHOT`: the batch had no rows, which is more likely a failed extract than
 *   a source with no students, so nobody is deleted.
 */
export type RosterReconciliation =
  'COMPLETED' | 'SKIPPED_QUARANTINED_ROWS' | 'SKIPPED_EMPTY_SNAPSHOT';

/** A parsed batch, reduced to what the rule reads. */
export interface ReconciliationInput {
  readonly batch: ImportBatch;
  readonly rows: readonly RosterRow[];
  readonly quarantined: readonly QuarantinedRow[];
}

/**
 * Decides whether publishing a batch may delete the students it omits.
 *
 * @param input - The batch with its valid and quarantined rows.
 * @returns Null for a `DELTA`, which never deletes by omission; otherwise the reconciliation
 *   to apply and report. Only `COMPLETED` deletes anyone.
 */
export function decideReconciliation(input: ReconciliationInput): RosterReconciliation | null {
  // SAFETY: missing from a DELTA is not deletion (docs/planning/09, Adapter envelope).
  if (input.batch.operation !== ImportOperation.Full) return null;
  // SAFETY: an incomplete or empty snapshot never deletes anyone. Expected cohort coverage
  // (a maximum share of students one batch may delete) is tracked in #257 and must land before
  // a real FULL feed is enabled.
  if (input.quarantined.length > 0) return 'SKIPPED_QUARANTINED_ROWS';
  if (input.rows.length === 0) return 'SKIPPED_EMPTY_SNAPSHOT';
  return 'COMPLETED';
}
