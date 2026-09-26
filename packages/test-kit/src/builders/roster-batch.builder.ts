/**
 * @file Builds a synthetic roster import batch: an envelope plus rows whose checksum and count agree.
 * @module @caa/test-kit/builders/roster-batch
 * @requirement FR-03
 * @requirement NFR-04
 * @see packages/test-kit/src/serialization/roster-checksum.ts
 */
import {
  createRosterRow,
  type ImportBatch,
  type ImportBatchInput,
  type RosterRow,
  type RosterRowInput,
} from '@caa/domain';

import { computeRosterChecksum } from '../serialization/roster-checksum';
import { buildImportBatch } from './import-batch.builder';
import { buildRosterRow } from './roster-row.builder';

/** Options for {@link buildRosterBatch}. `checksum` and `recordCount` are always derived. */
export type RosterBatchOptions = Partial<Omit<ImportBatchInput, 'checksum' | 'recordCount'>> & {
  /** Rows in batch order. Defaults to three non-deleted rows, `SYN-000001` to `SYN-000003`. */
  rows?: readonly RosterRowInput[];
};

/** An import batch envelope together with the rows it describes. */
export interface RosterBatch {
  batch: ImportBatch;
  rows: readonly RosterRow[];
}

/**
 * Builds a roster batch whose `checksum` is the canonical SHA-256 of its rows and whose
 * `recordCount` equals the number of rows, tombstones included.
 *
 * @param options - Envelope fields to replace in the default, plus the rows.
 * @returns The validated envelope and rows.
 */
export function buildRosterBatch(options: RosterBatchOptions = {}): RosterBatch {
  const { rows: rowInputs, ...envelope } = options;
  const rows = (rowInputs ?? [1, 2, 3].map((seed) => buildRosterRow({}, seed))).map((row) =>
    createRosterRow(row),
  );
  const batch = buildImportBatch({
    ...envelope,
    checksum: computeRosterChecksum(rows),
    recordCount: rows.length,
  });
  return { batch, rows };
}
