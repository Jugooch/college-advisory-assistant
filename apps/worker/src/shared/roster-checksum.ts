/**
 * @file Canonical SHA-256 checksum of the rows in a roster import batch.
 * @module @caa/worker/shared/roster-checksum
 * @requirement FR-03
 * @see docs/planning/09-data-model-and-integration-contracts.md
 *
 * Canonical serialization, agreed with QA in #12 (the test-kit implements the same algorithm):
 *
 * 1. Keep the rows in batch order. Rows are not sorted.
 * 2. Serialize each row as `JSON.stringify` of an object with exactly the keys `sourceStudentId`,
 *    `recordVersion`, `isDeleted`, in that order. Any other keys on the row are ignored.
 * 3. Join the serialized rows with a single `\n`. No trailing newline. Zero rows give `''`.
 * 4. Take the SHA-256 digest of the UTF-8 bytes, written as 64 lowercase hex characters.
 */
import { createHash } from 'node:crypto';

import { z } from 'zod';

/** Accepts any plain object so its fields can be read without a cast. */
const RawRowFieldsSchema = z.record(z.string(), z.unknown());

/**
 * Serializes one raw row in canonical form. Rows are checksummed before they are validated, so
 * a malformed row still contributes deterministically; a non-object row serializes as `{}`.
 *
 * @param raw - Row exactly as received from the source.
 * @returns The canonical JSON for the row.
 */
function serializeRow(raw: unknown): string {
  const parsed = RawRowFieldsSchema.safeParse(raw);
  const fields = parsed.success ? parsed.data : {};
  return JSON.stringify({
    sourceStudentId: fields.sourceStudentId,
    recordVersion: fields.recordVersion,
    isDeleted: fields.isDeleted,
  });
}

/**
 * Computes the canonical checksum of roster rows as received, before validation.
 *
 * @param rows - Raw rows in batch order.
 * @returns The SHA-256 digest as 64 lowercase hex characters.
 */
export function computeRosterChecksum(rows: readonly unknown[]): string {
  const payload = rows.map(serializeRow).join('\n');
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}
