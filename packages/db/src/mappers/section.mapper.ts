/**
 * @file Converts section rows and their meeting rows into section domain objects.
 * @module @caa/db/mappers/section
 * @requirement FR-07
 */
import { createSection, type Section } from '@caa/domain';

import type { SectionRow } from '../tables/section.table';
import type { SectionMeetingRow } from '../tables/section-meeting.table';
import { toMeetingPattern } from './meeting-pattern.mapper';

/**
 * Maps a section row and its meeting rows to a validated domain object.
 *
 * @param row - Row read from the `section` table.
 * @param meetingRows - Its `section_meeting` rows, in position order.
 * @returns The domain section.
 * @throws {z.ZodError} When the stored section or a meeting violates the domain schema.
 */
export function toSection(row: SectionRow, meetingRows: readonly SectionMeetingRow[]): Section {
  return createSection({
    id: row.id,
    tenantId: row.tenantId,
    termId: row.termId,
    courseId: row.courseId,
    sourceSectionId: row.sourceSectionId,
    sectionCode: row.sectionCode,
    campusId: row.campusId,
    modality: row.modality,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    meetings: meetingRows.map(toMeetingPattern),
  });
}
