/**
 * @file Read-only data access for published section snapshots with sections, meetings and links.
 * @module @caa/db/repositories/section-snapshot
 * @requirement FR-07
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/planning/09-data-model-and-integration-contracts.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { and, asc, desc, eq } from 'drizzle-orm';

import {
  type InstitutionId,
  type SectionSnapshot,
  type SectionSnapshotId,
  SectionSnapshotIdSchema,
  type Term,
  type TermId,
} from '@caa/domain';

import type { Database } from '../client';
import { toLinkedSectionGroup } from '../mappers/linked-section-group.mapper';
import { toSection } from '../mappers/section.mapper';
import { toSectionSnapshot } from '../mappers/section-snapshot.mapper';
import { toTerm } from '../mappers/term.mapper';
import { sectionTable } from '../tables/section.table';
import {
  sectionLinkComponentTable,
  sectionLinkGroupTable,
  sectionLinkMemberTable,
} from '../tables/section-link-group.table';
import { sectionMeetingTable } from '../tables/section-meeting.table';
import { type SectionSnapshotRow, sectionSnapshotTable } from '../tables/section-snapshot.table';
import { termTable } from '../tables/term.table';

/**
 * Result of {@link SectionSnapshotRepository.findLatestPublished}. `AMBIGUOUS` means two
 * snapshots share the newest source effective time, so the source doesn't say which is newer.
 */
export type LatestSectionSnapshot =
  | { readonly status: 'FOUND'; readonly snapshot: SectionSnapshot }
  | { readonly status: 'AMBIGUOUS' };

/**
 * The head of a term's latest snapshot, without its sections. `AMBIGUOUS` means two snapshots
 * share the newest source effective time, as for {@link LatestSectionSnapshot}.
 */
export type LatestSectionSnapshotHead =
  | {
      readonly status: 'FOUND';
      readonly sectionSnapshotId: SectionSnapshotId;
      readonly sourceEffectiveAt: string;
    }
  | { readonly status: 'AMBIGUOUS' };

/** One term that has a published snapshot, with the head of its latest one. */
export interface TermLatestSectionSnapshot {
  readonly term: Term;
  readonly latest: LatestSectionSnapshotHead;
}

/** Reads published section snapshots. Immutable revisions, so there are no update methods. */
export interface SectionSnapshotRepository {
  /**
   * Finds the term's latest published snapshot: the one with the strictly newest
   * `sourceEffectiveAt`. Ingestion time never decides. A tie for newest is `AMBIGUOUS`, never
   * a pick.
   *
   * @param tenantId - Tenant that owns the term.
   * @param termId - Term whose sections are wanted.
   * @returns The latest snapshot with its sections and linked-section groups, or the
   *   ambiguity, or null when the term has no snapshot or belongs to another tenant.
   * @throws {z.ZodError} When a stored snapshot, section, meeting or group is invalid.
   */
  findLatestPublished(
    tenantId: InstitutionId,
    termId: TermId,
  ): Promise<LatestSectionSnapshot | null>;
}

/**
 * {@link SectionSnapshotRepository} plus the per-term listing. A separate interface so
 * existing consumers' test doubles keep compiling until they need the listing.
 */
export interface TermSectionSnapshotRepository extends SectionSnapshotRepository {
  /**
   * Lists each of the tenant's terms that has a published snapshot, with the head of its
   * latest one, judged as {@link SectionSnapshotRepository.findLatestPublished} does. Loads no
   * sections, meetings or links. Freshness isn't judged here.
   *
   * @param tenantId - Tenant that owns the terms.
   * @returns Entries ordered by term `sequence` ascending; terms with no snapshot are absent.
   * @throws {z.ZodError} When a stored term is invalid.
   */
  listLatestPublishedByTerm(tenantId: InstitutionId): Promise<readonly TermLatestSectionSnapshot[]>;
}

/**
 * Loads one snapshot's sections, meetings and link rows, each in a fixed order, and maps them.
 *
 * @param db - Typed database handle.
 * @param tenantId - Tenant that owns the snapshot.
 * @param row - The snapshot row.
 * @returns The domain snapshot.
 * @throws {z.ZodError} When anything stored is invalid.
 */
async function loadSnapshot(
  db: Database,
  tenantId: InstitutionId,
  row: SectionSnapshotRow,
): Promise<SectionSnapshot> {
  const sections = sectionTable;
  const meetings = sectionMeetingTable;
  const groups = sectionLinkGroupTable;
  const components = sectionLinkComponentTable;
  const members = sectionLinkMemberTable;
  // SECURITY: every read is filtered by tenant as well as by the snapshot.
  const [sectionRows, meetingRows, groupRows, componentRows, memberRows] = await Promise.all([
    db
      .select()
      .from(sections)
      .where(and(eq(sections.tenantId, tenantId), eq(sections.sectionSnapshotId, row.id)))
      .orderBy(asc(sections.sourceSectionId)),
    db
      .select({ meeting: meetings })
      .from(meetings)
      .innerJoin(
        sections,
        and(eq(sections.tenantId, meetings.tenantId), eq(sections.id, meetings.sectionId)),
      )
      .where(and(eq(meetings.tenantId, tenantId), eq(sections.sectionSnapshotId, row.id)))
      .orderBy(asc(meetings.sectionId), asc(meetings.position)),
    db
      .select()
      .from(groups)
      .where(and(eq(groups.tenantId, tenantId), eq(groups.sectionSnapshotId, row.id)))
      .orderBy(asc(groups.id)),
    db
      .select()
      .from(components)
      .where(and(eq(components.tenantId, tenantId), eq(components.sectionSnapshotId, row.id)))
      .orderBy(asc(components.groupId), asc(components.position)),
    db
      .select()
      .from(members)
      .where(and(eq(members.tenantId, tenantId), eq(members.sectionSnapshotId, row.id)))
      .orderBy(asc(members.groupId), asc(members.componentPosition), asc(members.position)),
  ]);
  const meetingList = meetingRows.map(({ meeting }) => meeting);
  const mappedSections = sectionRows.map((section) =>
    toSection(
      section,
      meetingList.filter((meeting) => meeting.sectionId === section.id),
    ),
  );
  const mappedGroups = groupRows.map((group) =>
    toLinkedSectionGroup(
      group,
      componentRows.filter((component) => component.groupId === group.id),
      memberRows.filter((member) => member.groupId === group.id),
    ),
  );
  return toSectionSnapshot(row, mappedSections, mappedGroups);
}

/**
 * Creates the section snapshot repository.
 *
 * @param db - Typed database handle.
 * @returns A {@link TermSectionSnapshotRepository}.
 */
export function createSectionSnapshotRepository(db: Database): TermSectionSnapshotRepository {
  const snapshots = sectionSnapshotTable;
  return {
    async findLatestPublished(tenantId, termId) {
      const [newest, runnerUp] = await db
        .select()
        .from(snapshots)
        // SECURITY: every read is filtered by tenant.
        .where(and(eq(snapshots.tenantId, tenantId), eq(snapshots.termId, termId)))
        .orderBy(desc(snapshots.sourceEffectiveAt))
        .limit(2);
      if (!newest) {
        return null;
      }
      // SAFETY: only the source orders snapshots (planning/07 §Consistency model). An equal
      // newest source time is a conflict the caller reports (ADR-0010: 409 STALE_SOURCE),
      // never a guess.
      if (runnerUp?.sourceEffectiveAt.getTime() === newest.sourceEffectiveAt.getTime()) {
        return { status: 'AMBIGUOUS' };
      }
      return { status: 'FOUND', snapshot: await loadSnapshot(db, tenantId, newest) };
    },

    async listLatestPublishedByTerm(tenantId) {
      // SECURITY: both reads are filtered by tenant. Two queries however many terms there are.
      const [termRows, snapshotRows] = await Promise.all([
        db
          .select()
          .from(termTable)
          .where(eq(termTable.tenantId, tenantId))
          .orderBy(asc(termTable.sequence)),
        db
          .select({
            id: snapshots.id,
            termId: snapshots.termId,
            sourceEffectiveAt: snapshots.sourceEffectiveAt,
          })
          .from(snapshots)
          .where(eq(snapshots.tenantId, tenantId))
          .orderBy(asc(snapshots.termId), desc(snapshots.sourceEffectiveAt)),
      ]);
      const entries: TermLatestSectionSnapshot[] = [];
      for (const termRow of termRows) {
        const [newest, runnerUp] = snapshotRows.filter((row) => row.termId === termRow.id);
        if (!newest) {
          continue;
        }
        // SAFETY: a tie for newest is a conflict, never a pick (as in findLatestPublished).
        const isTied = runnerUp?.sourceEffectiveAt.getTime() === newest.sourceEffectiveAt.getTime();
        entries.push({
          term: toTerm(termRow),
          latest: isTied
            ? { status: 'AMBIGUOUS' }
            : {
                status: 'FOUND',
                sectionSnapshotId: SectionSnapshotIdSchema.parse(newest.id),
                sourceEffectiveAt: newest.sourceEffectiveAt.toISOString(),
              },
        });
      }
      return entries;
    },
  };
}
