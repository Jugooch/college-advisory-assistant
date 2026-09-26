/**
 * Canonical serialization, which the importer (#15) must reproduce exactly:
 *
 * 1. Keep the rows in batch order. Rows are not sorted.
 * 2. Serialize each row as `JSON.stringify` of an object with exactly these keys, in this order:
 *    `sourceStudentId` (string), `recordVersion` (integer or `null`), `isDeleted` (boolean).
 *    No whitespace; any other keys on the row are ignored.
 * 3. Join the serialized rows with a single `\n` (U+000A). No trailing newline. Zero rows give
 *    the empty string.
 * 4. Encode the result as UTF-8 and take its SHA-256 digest, written as 64 lowercase hex characters.
 *
 * Example: the rows `SYN-000001` (version 1, not deleted) and `SYN-000002` (version null,
 * deleted) serialize to
 * `{"sourceStudentId":"SYN-000001","recordVersion":1,"isDeleted":false}\n{"sourceStudentId":"SYN-000002","recordVersion":null,"isDeleted":true}`
 * with checksum `6342c62a60b40b247a04af936f4e3a380e5465400adaf7897934c3a5e0302a3e`.
 *
 * @file Canonical serialization and SHA-256 checksum of the rows in a roster import batch.
 * @module @caa/test-kit/serialization/roster-checksum
 * @requirement FR-03
 * @requirement NFR-04
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { createHash } from 'node:crypto';

import type { RosterRowInput } from '@caa/domain';

/**
 * Serializes roster rows in the canonical form described in the file header.
 *
 * @param rows - Rows in batch order.
 * @returns The canonical payload string.
 */
export function serializeRosterRows(rows: readonly RosterRowInput[]): string {
  return rows
    .map((row) =>
      JSON.stringify({
        sourceStudentId: row.sourceStudentId,
        recordVersion: row.recordVersion,
        isDeleted: row.isDeleted,
      }),
    )
    .join('\n');
}

/**
 * Computes the SHA-256 checksum of roster rows over their canonical serialization.
 *
 * @param rows - Rows in batch order.
 * @returns The digest as 64 lowercase hex characters.
 */
export function computeRosterChecksum(rows: readonly RosterRowInput[]): string {
  return createHash('sha256').update(serializeRosterRows(rows), 'utf8').digest('hex');
}
