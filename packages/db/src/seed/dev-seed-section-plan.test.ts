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

  it('links DEMO-PHYS 301 001 to exactly one of labs L01 or L02', () => {
    const idOf = (sourceSectionId: string) =>
      PLAN.snapshot.sections.find((section) => section.sourceSectionId === sourceSectionId)?.id;

    expect(PLAN.snapshot.linkedSectionGroups).toEqual([
      {
        id: 'e0000000-0001-4000-8000-01a0f755f200',
        tenantId: PLAN.snapshot.tenantId,
        primarySectionId: idOf('SYN-SEC-05'),
        components: [
          {
            name: 'Lab',
            courseId: SEED_CATALOG.phys301Lab.id,
            permittedSectionIds: [idOf('SYN-SEC-06'), idOf('SYN-SEC-07')],
          },
        ],
      },
    ]);
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
