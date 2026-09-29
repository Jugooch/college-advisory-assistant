/**
 * @file Tests for the section data object.
 */
import { describe, expect, it } from 'vitest';

import type { MeetingPatternInput } from './meeting-pattern.model';
import { createSection, type SectionInput, SectionSchema } from './section.model';

const NORTH_CAMPUS_ID = 'c4a1b2c3-0000-4000-8000-000000000001';

const ON_CAMPUS_MEETING: MeetingPatternInput = {
  weekdays: ['TUESDAY', 'THURSDAY'],
  startTime: '13:00',
  endTime: '14:15',
  startsOn: '2026-08-25',
  endsOn: '2026-12-10',
  excludedDates: [],
  location: { kind: 'ON_CAMPUS', campusId: NORTH_CAMPUS_ID, room: 'SCI 204' },
};

const ONLINE_MEETING: MeetingPatternInput = { ...ON_CAMPUS_MEETING, location: { kind: 'ONLINE' } };

const TBA_MEETING: MeetingPatternInput = {
  ...ON_CAMPUS_MEETING,
  weekdays: null,
  startTime: null,
  endTime: null,
  location: null,
};

const LECTURE: SectionInput = {
  id: '5ec71010-0000-4000-8000-000000000001',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  termId: '92a3b4c5-0000-4000-8000-000000000003',
  courseId: 'c0a5e000-0000-4000-8000-000000000301',
  sourceSectionId: 'PHYS301-001-2026FA',
  sectionCode: '001',
  campusId: NORTH_CAMPUS_ID,
  modality: 'IN_PERSON',
  startsOn: '2026-08-24',
  endsOn: '2026-12-11',
  meetings: [ON_CAMPUS_MEETING],
};

const ASYNC: SectionInput = {
  ...LECTURE,
  sectionCode: 'W01',
  campusId: null,
  modality: 'ONLINE_ASYNCHRONOUS',
  meetings: [],
};

describe('createSection', () => {
  it('accepts an in-person section with one meeting', () => {
    const section = createSection(LECTURE);

    expect([section.sectionCode, section.modality, section.meetings.length]).toEqual([
      '001',
      'IN_PERSON',
      1,
    ]);
  });

  it('accepts an online asynchronous section with dates and no meetings', () => {
    expect(createSection(ASYNC)).toMatchObject({
      modality: 'ONLINE_ASYNCHRONOUS',
      campusId: null,
      startsOn: '2026-08-24',
      endsOn: '2026-12-11',
      meetings: [],
    });
  });

  it('accepts a hybrid section with on-campus and online meetings', () => {
    const meetings = [ON_CAMPUS_MEETING, { ...ONLINE_MEETING, weekdays: ['FRIDAY'] as const }];

    expect(createSection({ ...LECTURE, modality: 'HYBRID', meetings }).meetings).toHaveLength(2);
  });

  it('accepts an online synchronous section with no campus', () => {
    const section = createSection({
      ...LECTURE,
      modality: 'ONLINE_SYNCHRONOUS',
      campusId: null,
      meetings: [ONLINE_MEETING],
    });

    expect(section.campusId).toBeNull();
  });

  it('accepts a section whose only meeting is wholly to be announced', () => {
    expect(createSection({ ...LECTURE, meetings: [TBA_MEETING] }).meetings[0]?.startTime).toBe(
      null,
    );
  });

  it('accepts a short-session section inside the term', () => {
    const meeting = { ...ON_CAMPUS_MEETING, startsOn: '2026-10-19', endsOn: '2026-12-10' };
    const section = { ...LECTURE, startsOn: '2026-10-19', meetings: [meeting] };

    expect(createSection(section).startsOn).toBe('2026-10-19');
  });

  it('rejects a section that ends before it starts', () => {
    expect(() => createSection({ ...ASYNC, endsOn: '2026-08-23' })).toThrow(
      /startsOn must not be later than endsOn/,
    );
  });

  it.each([
    { startsOn: '2026-08-23', endsOn: '2026-12-10' },
    { startsOn: '2026-08-25', endsOn: '2026-12-12' },
  ])('rejects a meeting outside the section dates %j', (dates) => {
    expect(() =>
      createSection({ ...LECTURE, meetings: [{ ...ON_CAMPUS_MEETING, ...dates }] }),
    ).toThrow(/Every meeting must fall within the section dates/);
  });

  it('rejects a timed section with no meetings', () => {
    expect(() => createSection({ ...LECTURE, meetings: [] })).toThrow(
      /Only an ONLINE_ASYNCHRONOUS section has no meetings/,
    );
  });

  it('rejects an online asynchronous section with a meeting', () => {
    expect(() => createSection({ ...ASYNC, meetings: [ONLINE_MEETING] })).toThrow(
      /Only an ONLINE_ASYNCHRONOUS section has no meetings/,
    );
  });

  it('rejects an in-person section with an online meeting', () => {
    expect(() => createSection({ ...LECTURE, meetings: [ONLINE_MEETING] })).toThrow(
      /meeting location contradicts the section modality/,
    );
  });

  it('rejects an online synchronous section with an on-campus meeting', () => {
    expect(() =>
      createSection({ ...LECTURE, modality: 'ONLINE_SYNCHRONOUS', campusId: null }),
    ).toThrow(/meeting location contradicts the section modality/);
  });

  it.each(['IN_PERSON', 'HYBRID'] as const)('rejects a %s section with no campus', (modality) => {
    expect(() => createSection({ ...LECTURE, modality, campusId: null })).toThrow(
      /must name its campus/,
    );
  });

  it('rejects an empty section code', () => {
    expect(() => createSection({ ...LECTURE, sectionCode: '' })).toThrow();
  });

  it('rejects a section with an invalid meeting', () => {
    expect(() =>
      createSection({ ...LECTURE, meetings: [{ ...ON_CAMPUS_MEETING, endTime: '12:00' }] }),
    ).toThrow(/startTime must be earlier than endTime/);
  });
});

describe('SectionSchema', () => {
  it('rejects an unknown modality', () => {
    expect(SectionSchema.safeParse({ ...LECTURE, modality: 'CORRESPONDENCE' }).success).toBe(false);
  });

  it('reports a missing campus on the campusId field', () => {
    const result = SectionSchema.safeParse({ ...LECTURE, campusId: null });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['campusId']]);
  });
});
