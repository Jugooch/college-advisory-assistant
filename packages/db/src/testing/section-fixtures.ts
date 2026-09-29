/**
 * @file Synthetic campuses, courses and section snapshots for repository integration tests.
 *   Test code only; every value is fictional.
 * @module @caa/db/testing/section-fixtures
 * @see docs/standards/07-testing.md
 */
import { randomUUID } from 'node:crypto';

import {
  type Campus,
  type CourseId,
  createCampus,
  createSectionSnapshot,
  type InstitutionId,
  MeetingLocationKind,
  type MeetingPatternInput,
  type SectionInput,
  SectionModality,
  type SectionSnapshot,
  type SectionSnapshotInput,
  type TermId,
  Weekday,
} from '@caa/domain';

import type { Database } from '../client';
import { insertCampuses, insertSectionSnapshot } from '../seed/section-snapshot-writer';
import { insertCourse, insertTerm } from './catalog-fixtures';

/** First day of the fixture term (the `insertTerm` default). */
export const TERM_STARTS_ON = '2026-08-24';
/** Last day of the fixture term (the `insertTerm` default). */
export const TERM_ENDS_ON = '2026-12-18';

/** One tenant's term, courses and campuses, ready for snapshots. */
export interface SectionWorld {
  readonly tenantId: InstitutionId;
  readonly termId: TermId;
  readonly math: CourseId;
  readonly phys: CourseId;
  readonly physLab: CourseId;
  readonly north: Campus;
  readonly south: Campus;
}

/**
 * Inserts a term, three courses and two campuses for a tenant.
 *
 * @param db - Database handle.
 * @param tenantId - Owning tenant.
 * @returns The IDs the snapshots refer to.
 */
export async function insertSectionWorld(
  db: Database,
  tenantId: InstitutionId,
): Promise<SectionWorld> {
  const termId = await insertTerm(db, tenantId, { termCode: '2026FA', sequence: 1 });
  const math = await insertCourse(db, tenantId, { sourceCourseId: 'DEMO-MATH-201' });
  const phys = await insertCourse(db, tenantId, { sourceCourseId: 'DEMO-PHYS-301' });
  const physLab = await insertCourse(db, tenantId, { sourceCourseId: 'DEMO-PHYS-301L' });
  const campus = (sourceCampusId: string, name: string) =>
    createCampus({ id: randomUUID(), tenantId, sourceCampusId, name });
  const north = campus('DEMO-N', 'North Campus');
  const south = campus('DEMO-S', 'South Campus');
  await insertCampuses(db, [north, south]);
  return { tenantId, termId, math, phys, physLab, north, south };
}

/**
 * Builds a full-term timed meeting.
 *
 * @param weekdays - Days it recurs on.
 * @param times - Local start and end, `HH:MM`.
 * @param location - Where it meets.
 * @returns The meeting input.
 */
function timedMeeting(
  weekdays: Weekday[],
  times: readonly [string, string],
  location: MeetingPatternInput['location'],
): MeetingPatternInput {
  return {
    weekdays,
    startTime: times[0],
    endTime: times[1],
    startsOn: TERM_STARTS_ON,
    endsOn: TERM_ENDS_ON,
    excludedDates: [],
    location,
  };
}

// SAFETY: to be announced is null days, times and location, never an empty list or midnight.
/** A wholly to-be-announced full-term meeting. */
const TO_BE_ANNOUNCED: MeetingPatternInput = {
  weekdays: null,
  startTime: null,
  endTime: null,
  startsOn: TERM_STARTS_ON,
  endsOn: TERM_ENDS_ON,
  excludedDates: [],
  location: null,
};

/** Section IDs the fixture snapshot's groups refer to. */
interface FixtureSectionIds {
  readonly math1: string;
  readonly math2: string;
  readonly phys1: string;
  readonly l01: string;
  readonly l02: string;
}

/**
 * Builds the fixture sections, in `sourceSectionId` order, as they read back.
 *
 * @param world - The tenant's term, courses and campuses.
 * @param ids - The section IDs to use.
 * @returns The section inputs.
 */
function buildSections(world: SectionWorld, ids: FixtureSectionIds): SectionInput[] {
  const base = {
    tenantId: world.tenantId,
    termId: world.termId,
    startsOn: TERM_STARTS_ON,
    endsOn: TERM_ENDS_ON,
  };
  const inPerson = { campusId: world.north.id, modality: SectionModality.InPerson };
  const onCampus = (campus: Campus, room: string | null) => ({
    kind: MeetingLocationKind.OnCampus,
    campusId: campus.id,
    room,
  });
  const mwf = [Weekday.Monday, Weekday.Wednesday, Weekday.Friday];
  const halfTerm = timedMeeting([Weekday.Tuesday, Weekday.Thursday], ['09:30', '10:45'], null);
  return [
    {
      ...base,
      ...inPerson,
      id: ids.math1,
      courseId: world.math,
      sourceSectionId: 'SYN-SEC-1',
      sectionCode: '001',
      meetings: [
        {
          ...timedMeeting(mwf, ['09:00', '09:50'], onCampus(world.north, 'SCI 204')),
          excludedDates: ['2026-09-07'],
        },
      ],
    },
    {
      ...base,
      id: ids.math2,
      courseId: world.math,
      sourceSectionId: 'SYN-SEC-2',
      sectionCode: '002',
      campusId: world.south.id,
      modality: SectionModality.InPerson,
      endsOn: '2026-10-16',
      meetings: [{ ...halfTerm, endsOn: '2026-10-16', location: onCampus(world.south, null) }],
    },
    {
      ...base,
      ...inPerson,
      id: ids.phys1,
      courseId: world.phys,
      sourceSectionId: 'SYN-SEC-3',
      sectionCode: '001',
      meetings: [TO_BE_ANNOUNCED],
    },
    ...buildLabSections(world, ids),
  ];
}

/**
 * Builds the two lab sections: one online with a meeting, one asynchronous with none.
 *
 * @param world - The tenant's term, courses and campuses.
 * @param ids - The section IDs to use.
 * @returns The lab section inputs.
 */
function buildLabSections(world: SectionWorld, ids: FixtureSectionIds): SectionInput[] {
  const base = {
    tenantId: world.tenantId,
    termId: world.termId,
    courseId: world.physLab,
    campusId: null,
    startsOn: TERM_STARTS_ON,
    endsOn: TERM_ENDS_ON,
  };
  const online = { kind: MeetingLocationKind.Online };
  return [
    {
      ...base,
      id: ids.l01,
      sourceSectionId: 'SYN-SEC-4',
      sectionCode: 'L01',
      modality: SectionModality.OnlineSynchronous,
      meetings: [timedMeeting([Weekday.Thursday], ['13:00', '15:50'], online)],
    },
    {
      ...base,
      id: ids.l02,
      sourceSectionId: 'SYN-SEC-5',
      sectionCode: 'L02',
      modality: SectionModality.OnlineAsynchronous,
      meetings: [],
    },
  ];
}

/**
 * Builds a valid snapshot with every meeting shape the store must keep: an on-campus meeting
 * with an excluded date, a half-term meeting, a wholly to-be-announced meeting, an online
 * meeting, an asynchronous section, and a linked group with an empty component.
 *
 * @param world - The tenant's term, courses and campuses.
 * @param overrides - Snapshot fields to change, such as `sourceEffectiveAt`.
 * @returns The validated snapshot.
 */
export function buildSectionSnapshot(
  world: SectionWorld,
  overrides: Partial<SectionSnapshotInput> = {},
): SectionSnapshot {
  const ids: FixtureSectionIds = {
    math1: randomUUID(),
    math2: randomUUID(),
    phys1: randomUUID(),
    l01: randomUUID(),
    l02: randomUUID(),
  };
  return createSectionSnapshot({
    id: randomUUID(),
    tenantId: world.tenantId,
    termId: world.termId,
    termStartsOn: TERM_STARTS_ON,
    termEndsOn: TERM_ENDS_ON,
    timezone: 'America/Chicago',
    sourceEffectiveAt: '2026-09-25T06:00:00.000Z',
    sections: buildSections(world, ids),
    linkedSectionGroups: [
      {
        id: randomUUID(),
        tenantId: world.tenantId,
        primarySectionId: ids.phys1,
        components: [
          { name: 'Lab', courseId: world.physLab, permittedSectionIds: [ids.l01, ids.l02] },
          { name: 'Recitation', courseId: world.phys, permittedSectionIds: [] },
        ],
      },
    ],
    ...overrides,
  });
}

/**
 * Builds a snapshot and writes it in one transaction.
 *
 * @param db - Database handle.
 * @param world - The tenant's term, courses and campuses.
 * @param overrides - Snapshot fields to change.
 * @returns The snapshot as written.
 */
export async function publishSectionSnapshot(
  db: Database,
  world: SectionWorld,
  overrides: Partial<SectionSnapshotInput> = {},
): Promise<SectionSnapshot> {
  const snapshot = buildSectionSnapshot(world, overrides);
  await db.transaction((tx) => insertSectionSnapshot(tx, snapshot));
  return snapshot;
}
