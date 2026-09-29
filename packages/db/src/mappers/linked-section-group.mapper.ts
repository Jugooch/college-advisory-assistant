/**
 * @file Converts linked-section group, component and member rows into domain objects.
 * @module @caa/db/mappers/linked-section-group
 * @requirement FR-07
 */
import { createLinkedSectionGroup, type LinkedSectionGroup } from '@caa/domain';

import type {
  SectionLinkComponentRow,
  SectionLinkGroupRow,
  SectionLinkMemberRow,
} from '../tables/section-link-group.table';

/**
 * Maps a group row and its component and member rows to a validated domain object.
 *
 * @param row - Row read from the `section_link_group` table.
 * @param componentRows - The group's components, in position order.
 * @param memberRows - The group's permitted sections, in position order within each component.
 * @returns The domain linked-section group. A component with no member rows has an empty
 *   permitted list, which the engine reports as UNKNOWN.
 * @throws {z.ZodError} When the stored group violates the domain schema.
 */
export function toLinkedSectionGroup(
  row: SectionLinkGroupRow,
  componentRows: readonly SectionLinkComponentRow[],
  memberRows: readonly SectionLinkMemberRow[],
): LinkedSectionGroup {
  return createLinkedSectionGroup({
    id: row.id,
    tenantId: row.tenantId,
    primarySectionId: row.primarySectionId,
    components: componentRows.map((component) => ({
      name: component.name,
      courseId: component.courseId,
      permittedSectionIds: memberRows
        .filter((member) => member.componentPosition === component.position)
        .map((member) => member.sectionId),
    })),
  });
}
