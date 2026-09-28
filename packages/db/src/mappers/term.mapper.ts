/**
 * @file Converts term rows into domain objects.
 * @module @caa/db/mappers/term
 * @requirement FR-06
 * @requirement FR-09
 */
import { createTerm, type Term } from '@caa/domain';

import type { TermRow } from '../tables/term.table';

/**
 * Maps a database row to a validated domain object. Term dates stay `YYYY-MM-DD` strings.
 *
 * @param row - Row read from the `term` table.
 * @returns The domain term.
 * @throws {z.ZodError} When the stored row violates the domain schema.
 */
export function toTerm(row: TermRow): Term {
  return createTerm({
    id: row.id,
    tenantId: row.tenantId,
    termCode: row.termCode,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    sequence: row.sequence,
  });
}
