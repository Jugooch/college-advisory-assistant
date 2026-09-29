/**
 * @file Writes campuses, published section snapshots and campus transition tables from validated
 *   domain objects. Insert-only and idempotent; shared by the seed and the integration fixtures.
 * @module @caa/db/seed/section-snapshot-writer
 * @requirement FR-07
 * @requirement NFR-01
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import type {
  Campus,
  CampusTransitionPolicy,
  LinkedSectionGroup,
  MeetingPattern,
  Section,
  SectionSnapshot,
} from '@caa/domain';

import type { Database } from '../client';
import { campusTable } from '../tables/campus.table';
import {
  campusTransitionTable,
  campusTransitionVersionTable,
} from '../tables/campus-transition.table';
import { sectionTable } from '../tables/section.table';
import {
  sectionLinkComponentTable,
  sectionLinkGroupTable,
  sectionLinkMemberTable,
} from '../tables/section-link-group.table';
import { sectionMeetingTable } from '../tables/section-meeting.table';
import { sectionSnapshotTable } from '../tables/section-snapshot.table';

/** The part of a database handle or transaction the writer uses. */
export type SectionWriter = Pick<Database, 'insert'>;

/**
 * Converts one meeting to its row.
 *
 * @param section - The meeting's section.
 * @param meeting - The meeting.
 * @param position - Its position in the section's meetings.
 * @returns The row values.
 */
function toMeetingRow(section: Section, meeting: MeetingPattern, position: number) {
  const location = meeting.location;
  return {
    tenantId: section.tenantId,
    sectionId: section.id,
    position,
    weekdays: meeting.weekdays === null ? null : [...meeting.weekdays],
    // SAFETY: a to-be-announced time stays null, never `00:00`.
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    startsOn: meeting.startsOn,
    endsOn: meeting.endsOn,
    excludedDates: [...meeting.excludedDates],
    locationKind: location?.kind ?? null,
    locationCampusId: location?.kind === 'ON_CAMPUS' ? location.campusId : null,
    room: location?.kind === 'ON_CAMPUS' ? location.room : null,
  };
}

/**
 * Writes a snapshot's linked-section groups, components and members.
 *
 * @param tx - Open transaction.
 * @param snapshot - The snapshot the groups belong to.
 * @param groups - The groups.
 */
async function insertGroups(
  tx: SectionWriter,
  snapshot: SectionSnapshot,
  groups: readonly LinkedSectionGroup[],
): Promise<void> {
  const scope = { tenantId: snapshot.tenantId, sectionSnapshotId: snapshot.id };
  await tx
    .insert(sectionLinkGroupTable)
    .values(
      groups.map((group) => ({ ...scope, id: group.id, primarySectionId: group.primarySectionId })),
    );
  const components = groups.flatMap((group) =>
    group.components.map((component, position) => ({ group, component, position })),
  );
  await tx.insert(sectionLinkComponentTable).values(
    components.map(({ group, component, position }) => ({
      ...scope,
      groupId: group.id,
      position,
      name: component.name,
      courseId: component.courseId,
    })),
  );
  const members = components.flatMap(({ group, component, position: componentPosition }) =>
    component.permittedSectionIds.map((sectionId, position) => ({
      ...scope,
      groupId: group.id,
      componentPosition,
      courseId: component.courseId,
      sectionId,
      position,
    })),
  );
  if (members.length > 0) {
    await tx.insert(sectionLinkMemberTable).values(members);
  }
}

/**
 * Writes campuses. A campus that already exists is left as it is.
 *
 * @param tx - Open transaction or handle.
 * @param campuses - The campuses.
 */
export async function insertCampuses(
  tx: SectionWriter,
  campuses: readonly Campus[],
): Promise<void> {
  if (campuses.length > 0) {
    await tx
      .insert(campusTable)
      .values(campuses.map((campus) => ({ ...campus })))
      .onConflictDoNothing({ target: campusTable.id });
  }
}

/**
 * Writes a published snapshot with its sections, meetings and links. A snapshot that already
 * exists is left as it is, contents included, because published snapshots are immutable.
 *
 * @param tx - Open transaction; the caller commits the whole snapshot together.
 * @param snapshot - The validated snapshot.
 * @throws {Error} When the database refuses a row, for example a course or campus of another
 *   tenant, or a term that doesn't match.
 */
export async function insertSectionSnapshot(
  tx: SectionWriter,
  snapshot: SectionSnapshot,
): Promise<void> {
  const { sections, linkedSectionGroups, ...fields } = snapshot;
  const inserted = await tx
    .insert(sectionSnapshotTable)
    .values({ ...fields, sourceEffectiveAt: new Date(snapshot.sourceEffectiveAt) })
    .onConflictDoNothing({ target: sectionSnapshotTable.id })
    .returning({ id: sectionSnapshotTable.id });
  if (inserted.length === 0 || sections.length === 0) {
    return;
  }
  await tx.insert(sectionTable).values(
    sections.map((section) => ({
      id: section.id,
      tenantId: section.tenantId,
      sectionSnapshotId: snapshot.id,
      termId: section.termId,
      courseId: section.courseId,
      sourceSectionId: section.sourceSectionId,
      sectionCode: section.sectionCode,
      campusId: section.campusId,
      modality: section.modality,
      startsOn: section.startsOn,
      endsOn: section.endsOn,
    })),
  );
  const meetingRows = sections.flatMap((section) =>
    section.meetings.map((meeting, position) => toMeetingRow(section, meeting, position)),
  );
  if (meetingRows.length > 0) {
    await tx.insert(sectionMeetingTable).values(meetingRows);
  }
  if (linkedSectionGroups.length > 0) {
    await insertGroups(tx, snapshot, linkedSectionGroups);
  }
}

/**
 * Writes one version of a campus transition table. A version that already exists is left as
 * it is.
 *
 * @param tx - Open transaction.
 * @param policy - The validated policy.
 * @param publishedAt - When the institution published it, ISO 8601 with offset.
 */
export async function insertCampusTransitionPolicy(
  tx: SectionWriter,
  policy: CampusTransitionPolicy,
  publishedAt: string,
): Promise<void> {
  const inserted = await tx
    .insert(campusTransitionVersionTable)
    .values({
      tenantId: policy.tenantId,
      version: policy.version,
      publishedAt: new Date(publishedAt),
    })
    // NOTE: only the same version is skipped; another version at the same publication time
    // still fails its unique key.
    .onConflictDoNothing({
      target: [campusTransitionVersionTable.tenantId, campusTransitionVersionTable.version],
    })
    .returning({ version: campusTransitionVersionTable.version });
  if (inserted.length > 0 && policy.transitions.length > 0) {
    await tx.insert(campusTransitionTable).values(
      policy.transitions.map((transition) => ({
        ...transition,
        tenantId: policy.tenantId,
        version: policy.version,
      })),
    );
  }
}
