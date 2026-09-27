/**
 * @file Parses and validates a synthetic roster document into an envelope, valid rows, and quarantined rows.
 * @module @caa/worker/adapters/synthetic/synthetic-roster
 * @requirement FR-03
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import type { QuarantinedRow } from '@caa/db';
import {
  type ImportBatch,
  ImportBatchSchema,
  type InstitutionId,
  type RosterRow,
  RosterRowSchema,
} from '@caa/domain';

import { computeRosterChecksum } from '../../shared/roster-checksum';

/** Row schema versions this adapter understands. Other versions may mean other row semantics. */
const SUPPORTED_SCHEMA_VERSIONS: ReadonlySet<string> = new Set(['1.0.0']);

/** Outer shape of a synthetic roster document: `{ batch, rows }`. */
const SyntheticRosterDocumentSchema = z.object({
  batch: z.unknown(),
  rows: z.array(z.unknown()),
});

/** Reads a row's source ID for the quarantine record, when it has a usable one. */
const SourceIdFieldSchema = z.object({ sourceStudentId: z.string().min(1) });

/** Why a whole batch was rejected before anything could be written. */
export type RosterBatchRejectionReason =
  | 'malformed_document'
  | 'invalid_envelope'
  | 'tenant_mismatch'
  | 'source_mismatch'
  | 'unsupported_schema_version'
  | 'record_count_mismatch'
  | 'checksum_mismatch';

/** The source a job expects the batch to come from. Set by the job, never read from the batch. */
export interface ExpectedRosterSource {
  readonly tenantId: InstitutionId;
  readonly sourceId: string;
}

/** Outcome of parsing a synthetic roster document. */
export type SyntheticRosterParseResult =
  | { readonly isValid: false; readonly reason: RosterBatchRejectionReason }
  | {
      readonly isValid: true;
      readonly batch: ImportBatch;
      /** Valid rows in batch order, each `sourceStudentId` at most once. */
      readonly rows: readonly RosterRow[];
      /** Rejected rows in batch order, each with a reason that never contains row values. */
      readonly quarantined: readonly QuarantinedRow[];
    };

/**
 * Checks the envelope against the expected source and the rows it describes.
 *
 * @param batch - Validated envelope.
 * @param rawRows - Rows as received.
 * @param expected - Tenant and source the job is importing for.
 * @returns The rejection reason, or null when the envelope matches.
 */
function checkEnvelope(
  batch: ImportBatch,
  rawRows: readonly unknown[],
  expected: ExpectedRosterSource,
): RosterBatchRejectionReason | null {
  // SECURITY: a batch may only write into the tenant and source the job was scheduled for.
  if (batch.tenantId !== expected.tenantId) return 'tenant_mismatch';
  if (batch.sourceId !== expected.sourceId) return 'source_mismatch';
  if (!SUPPORTED_SCHEMA_VERSIONS.has(batch.schemaVersion)) return 'unsupported_schema_version';
  if (batch.recordCount !== rawRows.length) return 'record_count_mismatch';
  if (batch.checksum !== computeRosterChecksum(rawRows)) return 'checksum_mismatch';
  return null;
}

/**
 * Validates one row.
 *
 * @param raw - Row as received.
 * @param rowIndex - Zero-based position in the batch.
 * @returns The valid row, or its quarantine record.
 */
function validateRow(raw: unknown, rowIndex: number): RosterRow | QuarantinedRow {
  const parsed = RosterRowSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const idField = SourceIdFieldSchema.safeParse(raw);
  // SECURITY: the reason names the failing field only; zod issue paths come from the schema,
  // never from row values.
  const field = parsed.error.issues[0]?.path.join('.') ?? '';
  return {
    rowIndex,
    sourceRecordId: idField.success ? idField.data.sourceStudentId : null,
    reason: field === '' ? 'invalid_row' : `invalid_field:${field}`,
  };
}

/**
 * Validates every row, then quarantines every row of any student ID that appears more than once.
 *
 * @param rawRows - Rows as received.
 * @returns Valid rows and quarantined rows, both in batch order.
 */
function splitRows(rawRows: readonly unknown[]): {
  readonly rows: readonly RosterRow[];
  readonly quarantined: readonly QuarantinedRow[];
} {
  const results = rawRows.map(validateRow);
  const occurrences = new Map<string, number>();
  for (const result of results) {
    if ('isDeleted' in result) {
      occurrences.set(result.sourceStudentId, (occurrences.get(result.sourceStudentId) ?? 0) + 1);
    }
  }
  const rows: RosterRow[] = [];
  const quarantined: QuarantinedRow[] = [];
  results.forEach((result, rowIndex) => {
    if (!('isDeleted' in result)) {
      quarantined.push(result);
    } else if ((occurrences.get(result.sourceStudentId) ?? 0) > 1) {
      // SAFETY: two rows for one student leave its state ambiguous; keep neither, never guess.
      quarantined.push({
        rowIndex,
        sourceRecordId: result.sourceStudentId,
        reason: 'duplicate_source_student_id',
      });
    } else {
      rows.push(result);
    }
  });
  return { rows, quarantined };
}

/**
 * Parses a synthetic roster document: validates the envelope, checks it against the expected
 * source, verifies `recordCount` and the canonical checksum over the rows as received, and
 * validates every row.
 *
 * @param document - Document exactly as received, shaped `{ batch, rows }`.
 * @param expected - Tenant and source the job is importing for.
 * @returns The parsed batch, or the reason the whole batch is rejected.
 */
export function parseSyntheticRoster(
  document: unknown,
  expected: ExpectedRosterSource,
): SyntheticRosterParseResult {
  const outer = SyntheticRosterDocumentSchema.safeParse(document);
  if (!outer.success) return { isValid: false, reason: 'malformed_document' };
  const envelope = ImportBatchSchema.safeParse(outer.data.batch);
  if (!envelope.success) return { isValid: false, reason: 'invalid_envelope' };
  const reason = checkEnvelope(envelope.data, outer.data.rows, expected);
  if (reason !== null) return { isValid: false, reason };
  return { isValid: true, batch: envelope.data, ...splitRows(outer.data.rows) };
}
