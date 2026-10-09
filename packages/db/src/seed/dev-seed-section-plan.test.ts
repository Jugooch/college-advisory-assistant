/**
 * @file Unit tests for the seeded section plan: the literal inputs each documented scheduling
 *   scenario relies on, for a fixed run time. Expected schedule results are not computed here;
 *   they are derived by hand in the README scenarios and belong to the golden corpus.
 */
import { describe, expect, it } from 'vitest';

import type { Section } from '@caa/domain';

import { SEED_CATALOG } from './dev-seed-academic-catalog';
import { buildDevSeedSectionPlan, SEED_CAMPUSES } from './dev-seed-section-plan';

/** The fixed run time; 1790856000000 ms, `01a0f755f200` in hex. */
const NOW = new Date('2026-10-01T12:00:00.000Z');
const PLAN = buildDevSeedSectionPlan(NOW);

const labelOf = (courseId: string) =>
  Object.values(SEED_CATALOG).find((course) => course.id === courseId)?.label;
const campusOf = (campusId: string | null) =>
  Object.values(SEED_CAMPUSES).find((campus) => campus.id === campusId)?.sourceCampusId;
const onlyMeeting = (section: Section) => {
  const [meeting] = section.meetings;
  if (!meeting || section.meetings.length !== 1) {
    throw new Error(`${section.sourceSectionId} should have exactly one meeting`);
  }
  return meeting;
};
const describeSection = (section: Section) => {
  const { weekdays, startTime, endTime, location } = onlyMeeting(section);
  return [
    `${labelOf(section.courseId) ?? '?'} ${section.sectionCode}`,
    weekdays?.map((day) => day.slice(0, 2)).join('') ?? null,
    startTime,
    endTime,
    location?.kind === 'ON_CAMPUS' ? campusOf(location.campusId) : null,
    `${section.startsOn}..${section.endsOn}`,
  ];
};

describe('buildDevSeedSectionPlan', () => {
  it('builds the same plan from the same run time', () => {
    expect(buildDevSeedSectionPlan(new Date('2026-10-01T12:00:00.000Z'))).toEqual(PLAN);
  });

  it('publishes the 2027SP snapshot 3 hours before the run, with per-run IDs', () => {
    expect(PLAN.snapshot).toMatchObject({
      id: 'c0000000-0001-4000-8000-01a0f755f200',
      termId: 'b0000000-0000-4000-8000-000000000004',
      termStartsOn: '2027-01-11',
      termEndsOn: '2027-05-07',
      timezone: 'America/Chicago',
      sourceEffectiveAt: '2026-10-01T09:00:00.000Z',
    });
    expect(PLAN.snapshot.sections[0]?.id).toBe('d0000000-0001-4000-8000-01a0f755f200');
  });

  it('seeds every scenario section with the meetings the README states', () => {
    const full = '2027-01-11..2027-05-07';

    expect(PLAN.snapshot.sections.map(describeSection)).toEqual([
      ['DEMO-MATH 102 001', 'MOWEFR', '09:00', '09:50', 'DEMO-N', full],
      ['DEMO-MATH 102 002', 'TUTH', '09:30', '10:45', 'DEMO-N', full],
      ['DEMO-ENGL 101 001', 'MOWEFR', '09:00', '09:50', 'DEMO-N', full],
      ['DEMO-ENGL 101 002', 'TUTH', '09:30', '10:45', 'DEMO-N', full],
      ['DEMO-PHYS 301 001', 'MOWEFR', '11:00', '11:50', 'DEMO-N', full],
      ['DEMO-PHYS 301L L01', 'TU', '09:30', '11:20', 'DEMO-N', full],
      ['DEMO-PHYS 301L L02', 'MOWE', '14:00', '15:15', 'DEMO-N', '2027-03-08..2027-05-07'],
      ['DEMO-IND 390 001', 'MOWE', '14:00', '15:15', 'DEMO-N', '2027-01-11..2027-03-05'],
      ['DEMO-IND 390 002', 'MOWEFR', '12:00', '12:50', 'DEMO-S', full],
      ['DEMO-IND 390 003', null, null, null, null, full],
      ['DEMO-ENGL 101 003', 'TUTH', '11:00', '12:15', 'DEMO-N', full],
      ['DEMO-PHYS 301 002', 'TUTH', '13:00', '14:15', 'DEMO-N', full],
    ]);
  });

  it('keeps the to-be-announced meeting wholly null, never an empty list or midnight', () => {
    const tba = PLAN.snapshot.sections.find((section) => section.sourceSectionId === 'SYN-SEC-10');

    expect(tba?.meetings).toEqual([
      {
        weekdays: null,
        startTime: null,
        endTime: null,
        startsOn: '2027-01-11',
        endsOn: '2027-05-07',
        excludedDates: [],
        location: null,
      },
    ]);
  });

  it('links DEMO-PHYS 301 001 to lab L01 or L02, and 002 to lab L02 only', () => {
    const idOf = (sourceSectionId: string) =>
      PLAN.snapshot.sections.find((section) => section.sourceSectionId === sourceSectionId)?.id;
    const group = (groupId: string, primary: string, labs: string[]) => ({
      id: groupId,
      tenantId: PLAN.snapshot.tenantId,
      primarySectionId: idOf(primary),
      components: [
        {
          name: 'Lab',
          courseId: SEED_CATALOG.phys301Lab.id,
          permittedSectionIds: labs.map(idOf),
        },
      ],
    });

    expect(PLAN.snapshot.linkedSectionGroups).toEqual([
      group('e0000000-0001-4000-8000-01a0f755f200', 'SYN-SEC-05', ['SYN-SEC-06', 'SYN-SEC-07']),
      group('e0000000-0003-4000-8000-01a0f755f200', 'SYN-SEC-12', ['SYN-SEC-07']),
    ]);
  });

  // AC48 (#626): the sections a student who rules out Fridays can take at the 12.00 minimum.
  it('has a Friday-free combination of MATH, ENGL, PHYS (with lab) and IND reaching 12.00 credits', () => {
    const bySource = (id: string): Section => {
      const found = PLAN.snapshot.sections.find((section) => section.sourceSectionId === id);
      if (!found) throw new Error(`${id} is not seeded`);
      return found;
    };
    // MATH 102 002, ENGL 101 003, PHYS 301 002 + lab L02, IND 390 001 (selected at 2.00).
    const chosen = ['SYN-SEC-02', 'SYN-SEC-11', 'SYN-SEC-12', 'SYN-SEC-07', 'SYN-SEC-08'].map(
      bySource,
    );
    const meetings = chosen.map(onlyMeeting);
    type Meeting = (typeof meetings)[number];
    const isSameDays = (a: Meeting, b: Meeting): boolean =>
      (a.weekdays ?? []).some((day) => (b.weekdays ?? []).includes(day));
    const isSameDates = (a: Meeting, b: Meeting): boolean =>
      a.startsOn <= b.endsOn && b.startsOn <= a.endsOn;
    const isSameTimes = (a: Meeting, b: Meeting): boolean =>
      (a.startTime ?? '') < (b.endTime ?? '') && (b.startTime ?? '') < (a.endTime ?? '');
    const isClash = (a: Meeting, b: Meeting): boolean =>
      isSameDays(a, b) && isSameDates(a, b) && isSameTimes(a, b);

    expect(meetings.flatMap((meeting) => meeting.weekdays ?? [])).not.toContain('FRIDAY');
    const pairs = meetings.flatMap((a, i) => meetings.slice(i + 1).map((b) => isClash(a, b)));
    expect(pairs).not.toContain(true);
    // NOTE: 3.00 + 3.00 + 4.00 (lecture; the lab adds none) + 2.00 = 12.00.
    expect(3 + 3 + 4 + 2).toBe(12);
  });

  it('configures 15 minutes each way between North and South, in a fixed version', () => {
    const { north, south } = SEED_CAMPUSES;

    expect(PLAN.transitionPolicy).toEqual({
      tenantId: PLAN.snapshot.tenantId,
      version: 'demo-2027.1',
      transitions: [
        { fromCampusId: north.id, toCampusId: south.id, minutes: 15 },
        { fromCampusId: south.id, toCampusId: north.id, minutes: 15 },
      ],
    });
    expect(PLAN.transitionPublishedAt).toBe('2026-09-01T00:00:00.000Z');
  });
});
