/**
 * @file Converts case event rows into domain objects.
 * @module @caa/db/mappers/case-event
 * @requirement FR-12
 */
import { type CaseEvent, CaseEventSchema } from '@caa/domain';

import type { CaseEventRow } from '../tables/case-event.table';

/**
 * Maps a database row to a validated domain event.
 *
 * @param row - Row read from the `case_event` table.
 * @returns The domain event, with the timestamp as an ISO string.
 * @throws {z.ZodError} When the stored row violates the domain schema. The error carries field
 *   paths, never the note.
 */
export function toCaseEvent(row: CaseEventRow): CaseEvent {
  return CaseEventSchema.parse({
    id: row.id,
    caseId: row.caseId,
    sequence: row.sequence,
    action: row.action,
    actorUserId: row.actorUserId,
    // SAFETY: the column is NOT NULL (migration 0017), so the role is always present; no fallback is applied.
    actorRole: row.actorRole,
    at: row.at.toISOString(),
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    resolution: row.resolution,
    note: row.note,
  });
}
