/**
 * @file Roster row data object: one student record inside an import batch.
 * @module @caa/domain/models/roster-row
 * @requirement FR-03
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

/**
 * Schema for one student roster row.
 *
 * A row belongs to an `ImportBatch` envelope, which carries the tenant and source.
 *
 * SAFETY: a student missing from a `DELTA` batch is unchanged, not deleted. Only a row with
 * `isDeleted: true` (a tombstone), or reconciliation of a completed `FULL` snapshot, removes one.
 */
export const RosterRowSchema = z
  .object({
    /** Student identifier in the source system (SIS). */
    sourceStudentId: z.string().min(1),
    /** Source record version, or `null` when the source does not supply one. */
    recordVersion: z.number().int().nullable(),
    /** Tombstone flag. `true` deletes the student; `false` inserts or updates it. */
    isDeleted: z.boolean(),
  })
  .readonly();

/** A validated, immutable roster row. */
export type RosterRow = z.infer<typeof RosterRowSchema>;

/** Raw input accepted by {@link createRosterRow}. */
export type RosterRowInput = z.input<typeof RosterRowSchema>;

/**
 * Creates a validated, immutable roster row.
 *
 * @param input - Raw row fields.
 * @returns The parsed roster row.
 * @throws {z.ZodError} When any field is invalid.
 */
export function createRosterRow(input: RosterRowInput): RosterRow {
  return RosterRowSchema.parse(input);
}
