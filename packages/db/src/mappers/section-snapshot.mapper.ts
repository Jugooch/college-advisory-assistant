/**
 * @file Converts a section snapshot row and its sections and groups into a domain object.
 * @module @caa/db/mappers/section-snapshot
 * @requirement FR-07
 * @requirement NFR-01
 */
import {
  createSectionSnapshot,
  type LinkedSectionGroup,
  type Section,
  type SectionSnapshot,
} from '@caa/domain';

import type { SectionSnapshotRow } from '../tables/section-snapshot.table';

/**
 * Maps a snapshot row with its mapped sections and groups to a validated domain object. The
 * ingestion time stays in the database.
 *
 * @param row - Row read from the `section_snapshot` table.
 * @param sections - Its sections.
 * @param linkedSectionGroups - Its linked-section groups.
 * @returns The domain section snapshot, with `sourceEffectiveAt` as an ISO string.
 * @throws {z.ZodError} When the snapshot violates the domain schema, for example a section
 *   outside the term dates or a link to a section of another course.
 */
export function toSectionSnapshot(
  row: SectionSnapshotRow,
  sections: readonly Section[],
  linkedSectionGroups: readonly LinkedSectionGroup[],
): SectionSnapshot {
  return createSectionSnapshot({
    id: row.id,
    tenantId: row.tenantId,
    termId: row.termId,
    termStartsOn: row.termStartsOn,
    termEndsOn: row.termEndsOn,
    timezone: row.timezone,
    sourceEffectiveAt: row.sourceEffectiveAt.toISOString(),
    sections,
    linkedSectionGroups,
  });
}
