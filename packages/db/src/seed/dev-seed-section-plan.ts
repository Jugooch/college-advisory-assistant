/**
 * @file The synthetic 2027SP section snapshot, campuses, and campus transition table the dev
 *   seed writes: the first vertical slice's four sections with a conflict, plus linked-lab,
 *   half-term, travel-time, and to-be-announced scenarios. Data only; built with the domain
 *   factories, so an invalid record fails when the plan is built.
 * @module @caa/db/seed/dev-seed-section-plan
 * @requirement FR-07
 * @requirement FR-18
 * @see docs/planning/14-delivery-roadmap-and-backlog.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import {
  type Campus,
  type CampusTransitionPolicy,
  createCampus,
  createCampusTransitionPolicy,
  createSectionSnapshot,
  MeetingLocationKind,
  type MeetingPatternInput,
  type SectionInput,
  SectionModality,
  type SectionSnapshot,
  Weekday,
} from '@caa/domain';

import { SEED_CATALOG, SEED_TENANT_ID, SEED_TERMS, seedId } from './dev-seed-academic-catalog';
import { seedRecordTimes, seedRevisionId } from './dev-seed-record-times';

/** Everything scheduling-related the dev seed writes, for one tenant. */
export interface DevSeedSectionPlan {
  readonly campuses: readonly Campus[];
  readonly transitionPolicy: CampusTransitionPolicy;
  /** When the institution published the transition table. Fixed, so re-runs write it once. */
  readonly transitionPublishedAt: string;
  readonly snapshot: SectionSnapshot;
}

/** The seeded campuses; the IDs are fixed. */
export const SEED_CAMPUSES = {
  north: createCampus({
    id: seedId('f0000000', 1),
    tenantId: SEED_TENANT_ID,
    sourceCampusId: 'DEMO-N',
    name: 'North Campus',
  }),
  south: createCampus({
    id: seedId('f0000000', 2),
    tenantId: SEED_TENANT_ID,
    sourceCampusId: 'DEMO-S',
    name: 'South Campus',
  }),
} as const;

/**
 * Minutes needed between campuses. The travel scenario leaves 10 minutes between a North
 * meeting and a South one, so 15 is too short on purpose (AC08).
 */
export const SEED_TRANSITION_MINUTES = 15;

// NOTE: 2027SP runs 2027-01-11 to 2027-05-07. The half-term scenario splits it into two
// disjoint halves at the weekend between them.
const PLANNING_TERM = SEED_TERMS.find((term) => term.termCode === '2027SP');
const FIRST_HALF = ['2027-01-11', '2027-03-05'] as const;
const SECOND_HALF = ['2027-03-08', '2027-05-07'] as const;

const MWF = [Weekday.Monday, Weekday.Wednesday, Weekday.Friday];
const TU_TH = [Weekday.Tuesday, Weekday.Thursday];
const MW = [Weekday.Monday, Weekday.Wednesday];

/** One seeded section, in the compact form the table below uses. */
interface SectionSpec {
  /** Slot in the section's per-run ID; also its `SYN-SEC-nn` source ID. */
  readonly slot: number;
  readonly courseId: string;
  readonly code: string;
  readonly campus: Campus;
  /** Days and local times, or null for a wholly to-be-announced meeting. */
  readonly meets: readonly [Weekday[], string, string] | null;
  /** The section's date range; the full term when omitted. */
  readonly dates?: readonly [string, string];
}

const { math102, engl101, phys301, phys301Lab, ind390 } = SEED_CATALOG;
const { north, south } = SEED_CAMPUSES;

// NOTE: the expected results for these sections are derived by hand in the PR and the README
// scenarios, never from engine output.
/** The seeded sections. */
const SECTION_SPECS: readonly SectionSpec[] = [
  // Vertical slice: MATH 102 and ENGL 101 give exactly two feasible pairs.
  { slot: 1, courseId: math102.id, code: '001', campus: north, meets: [MWF, '09:00', '09:50'] },
  { slot: 2, courseId: math102.id, code: '002', campus: north, meets: [TU_TH, '09:30', '10:45'] },
  { slot: 3, courseId: engl101.id, code: '001', campus: north, meets: [MWF, '09:00', '09:50'] },
  { slot: 4, courseId: engl101.id, code: '002', campus: north, meets: [TU_TH, '09:30', '10:45'] },
  // Linked lab (AC06): PHYS 301 001 requires L01 or L02; L01 overlaps the TuTh 09:30 lectures.
  { slot: 5, courseId: phys301.id, code: '001', campus: north, meets: [MWF, '11:00', '11:50'] },
  {
    slot: 6,
    courseId: phys301Lab.id,
    code: 'L01',
    campus: north,
    meets: [[Weekday.Tuesday], '09:30', '11:20'],
  },
  // Half-term (AC07): L02 and IND 390 001 meet at the same weekly time in disjoint halves.
  {
    slot: 7,
    courseId: phys301Lab.id,
    code: 'L02',
    campus: north,
    meets: [MW, '14:00', '15:15'],
    dates: SECOND_HALF,
  },
  {
    slot: 8,
    courseId: ind390.id,
    code: '001',
    campus: north,
    meets: [MW, '14:00', '15:15'],
    dates: FIRST_HALF,
  },
  // Travel (AC08): 10 minutes after PHYS 301 001 ends on North, this starts on South.
  { slot: 9, courseId: ind390.id, code: '002', campus: south, meets: [MWF, '12:00', '12:50'] },
  // Unknown: the registrar hasn't announced this section's days, times, or room.
  { slot: 10, courseId: ind390.id, code: '003', campus: north, meets: null },
  // No Fridays (AC48, #626): with MATH 102 002 (TuTh 09:30) these two TuTh sections, lab L02
  // (MW, second half) and IND 390 001 (MW, first half) make a Friday-free 12.00-credit option.
  { slot: 11, courseId: engl101.id, code: '003', campus: north, meets: [TU_TH, '11:00', '12:15'] },
  { slot: 12, courseId: phys301.id, code: '002', campus: north, meets: [TU_TH, '13:00', '14:15'] },
];

/** Slots of the labs PHYS 301 001 accepts, and of the one lab PHYS 301 002 accepts (non-Friday). */
const LAB_SLOTS_FIRST = [6, 7];
const LAB_SLOTS_TUTH = [7];

/**
 * Builds the two PHYS 301 linked-section groups for one snapshot.
 *
 * @param now - The run time the IDs derive from.
 * @param offset - Added to every section slot (the revision's offset, or 0).
 * @param groupSlots - ID slots of the two groups.
 * @returns The groups: 001 with labs L01 or L02, 002 with lab L02 only.
 */
function toLinkedGroups(now: Date, offset: number, groupSlots: readonly [number, number]) {
  const group = (groupSlot: number, primarySlot: number, labSlots: readonly number[]) => ({
    id: seedRevisionId('e0000000', groupSlot, now),
    tenantId: SEED_TENANT_ID,
    primarySectionId: seedRevisionId('d0000000', primarySlot + offset, now),
    components: [
      {
        name: 'Lab',
        courseId: phys301Lab.id,
        permittedSectionIds: labSlots.map((slot) => seedRevisionId('d0000000', slot + offset, now)),
      },
    ],
  });
  return [group(groupSlots[0], 5, LAB_SLOTS_FIRST), group(groupSlots[1], 12, LAB_SLOTS_TUTH)];
}

/**
 * Builds one section from its spec.
 *
 * @param spec - The compact section.
 * @param run - The time the seed run started, and the offset added to section ID slots.
 * @param term - The planning term's ID and dates.
 * @returns The section input.
 */
function toSection(
  spec: SectionSpec,
  run: { readonly now: Date; readonly slotOffset: number },
  term: { readonly id: string; readonly startsOn: string; readonly endsOn: string },
): SectionInput {
  const [startsOn, endsOn] = spec.dates ?? [term.startsOn, term.endsOn];
  const days = { startsOn, endsOn, excludedDates: [] };
  // SAFETY: to be announced is null days, times and location, never an empty list or midnight.
  const meeting: MeetingPatternInput =
    spec.meets === null
      ? { ...days, weekdays: null, startTime: null, endTime: null, location: null }
      : {
          ...days,
          weekdays: spec.meets[0],
          startTime: spec.meets[1],
          endTime: spec.meets[2],
          location: { kind: MeetingLocationKind.OnCampus, campusId: spec.campus.id, room: null },
        };
  return {
    id: seedRevisionId('d0000000', spec.slot + run.slotOffset, run.now),
    tenantId: SEED_TENANT_ID,
    termId: term.id,
    courseId: spec.courseId,
    sourceSectionId: `SYN-SEC-${String(spec.slot).padStart(2, '0')}`,
    sectionCode: spec.code,
    campusId: spec.campus.id,
    modality: SectionModality.InPerson,
    startsOn,
    endsOn,
    meetings: [meeting],
  };
}

/** Slot of the section the revision withdraws: MATH 102 002 (TuTh). */
export const WITHDRAWN_SECTION_SLOT = 2;
/** Added to a revision's section slots, so its IDs never collide with a seed run's. */
const REVISION_SLOT_OFFSET = 100;

/**
 * Builds a newer 2027SP section snapshot in which one section is withdrawn (MATH 102 002). A
 * draft pinned to an earlier snapshot is then superseded. Every other section is unchanged.
 *
 * @param now - The time the revision run started; the snapshot takes effect at this instant.
 * @returns The new snapshot, a fresh revision with its own IDs.
 * @throws {Error} When the seeded calendar has no 2027SP term.
 * @throws {z.ZodError} When a built record violates its domain schema.
 */
export function buildWithdrawnSectionSnapshot(now: Date): SectionSnapshot {
  if (!PLANNING_TERM) {
    throw new Error('The seeded calendar has no 2027SP term');
  }
  const offset = REVISION_SLOT_OFFSET;
  return createSectionSnapshot({
    id: seedRevisionId('c0000000', 2, now),
    tenantId: SEED_TENANT_ID,
    termId: PLANNING_TERM.id,
    termStartsOn: PLANNING_TERM.startsOn,
    termEndsOn: PLANNING_TERM.endsOn,
    timezone: 'America/Chicago',
    sourceEffectiveAt: now.toISOString(),
    sections: SECTION_SPECS.filter((spec) => spec.slot !== WITHDRAWN_SECTION_SLOT).map((spec) =>
      toSection(spec, { now, slotOffset: offset }, PLANNING_TERM),
    ),
    linkedSectionGroups: toLinkedGroups(now, offset, [2, 4]),
  });
}

/**
 * Builds the scheduling part of one seed run. The campuses and transition table are fixed; the
 * section snapshot is a new revision timed relative to `now`, like the student records.
 *
 * @param now - The time the seed run started, read once by the caller.
 * @returns The plan. The same `now` always gives the same plan.
 * @throws {Error} When the seeded calendar has no 2027SP term.
 * @throws {z.ZodError} When a built record violates its domain schema.
 */
export function buildDevSeedSectionPlan(now: Date): DevSeedSectionPlan {
  if (!PLANNING_TERM) {
    throw new Error('The seeded calendar has no 2027SP term');
  }
  const transitions = [
    { fromCampusId: north.id, toCampusId: south.id, minutes: SEED_TRANSITION_MINUTES },
    { fromCampusId: south.id, toCampusId: north.id, minutes: SEED_TRANSITION_MINUTES },
  ];
  const snapshot = createSectionSnapshot({
    id: seedRevisionId('c0000000', 1, now),
    tenantId: SEED_TENANT_ID,
    termId: PLANNING_TERM.id,
    termStartsOn: PLANNING_TERM.startsOn,
    termEndsOn: PLANNING_TERM.endsOn,
    timezone: 'America/Chicago',
    // SAFETY: published at the current record's time, 3 hours before the run, so it is fresh
    // under the 24-hour limit for published section structure (planning/09).
    sourceEffectiveAt: seedRecordTimes(now).currentRecordEffectiveAt,
    sections: SECTION_SPECS.map((spec) => toSection(spec, { now, slotOffset: 0 }, PLANNING_TERM)),
    linkedSectionGroups: toLinkedGroups(now, 0, [1, 3]),
  });
  return {
    campuses: Object.values(SEED_CAMPUSES),
    transitionPolicy: createCampusTransitionPolicy({
      tenantId: SEED_TENANT_ID,
      version: 'demo-2027.1',
      transitions,
    }),
    transitionPublishedAt: '2026-09-01T00:00:00.000Z',
    snapshot,
  };
}
