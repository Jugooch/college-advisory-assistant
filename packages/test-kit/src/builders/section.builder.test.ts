/**
 * @file Tests for the synthetic section builders.
 */
import { describe, expect, it } from 'vitest';

import { SectionSchema } from '@caa/domain';

import {
  buildHalfTermSection,
  buildOnlineAsynchronousSection,
  buildSection,
} from './section.builder';

const NORTH_CAMPUS_ID = 'd0000000-0000-4000-8000-000000000001';

const MWF_0900_WHOLE_TERM = {
  weekdays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
  startTime: '09:00',
  endTime: '09:50',
  startsOn: '2027-01-11',
  endsOn: '2027-05-07',
  excludedDates: [],
  location: { kind: 'ON_CAMPUS', campusId: NORTH_CAMPUS_ID, room: null },
} as const;

describe('buildSection', () => {
  it('defaults to an in-person section of course seed 1 meeting MWF 09:00 to 09:50 in 2027SP', () => {
    expect(buildSection()).toEqual({
      id: 'c0000000-0000-4000-8000-000000000001',
      tenantId: '10000000-0000-4000-8000-000000000001',
      termId: 'b0000000-0000-4000-8000-000000000004',
      courseId: '50000000-0000-4000-8000-000000000001',
      sourceSectionId: 'DEMO-SEC-001',
      sectionCode: '001',
      campusId: NORTH_CAMPUS_ID,
      modality: 'IN_PERSON',
      startsOn: '2027-01-11',
      endsOn: '2027-05-07',
      meetings: [MWF_0900_WHOLE_TERM],
    });
  });

  it('derives the id, source ID and section code from the seed', () => {
    const section = buildSection({}, 12);

    expect([section.id, section.sourceSectionId, section.sectionCode]).toEqual([
      'c0000000-0000-4000-8000-00000000000c',
      'DEMO-SEC-012',
      '012',
    ]);
  });

  it('gives two sections of different seeds the same meeting, so defaults never avoid a conflict', () => {
    expect(buildSection({}, 2).meetings).toEqual(buildSection({}, 3).meetings);
  });

  it('returns deep-equal sections for the same arguments', () => {
    expect(buildSection({ sectionCode: 'L01' }, 4)).toEqual(
      buildSection({ sectionCode: 'L01' }, 4),
    );
  });

  it('applies overrides', () => {
    expect(buildSection({ courseId: '50000000-0000-4000-8000-000000000002' }).courseId).toBe(
      '50000000-0000-4000-8000-000000000002',
    );
  });

  it('returns a section that passes the domain schema', () => {
    expect(SectionSchema.safeParse(buildSection()).success).toBe(true);
  });

  it('rejects an in-person section with no meetings', () => {
    expect(() => buildSection({ meetings: [] })).toThrow();
  });

  it('rejects an in-person section with no campus', () => {
    expect(() => buildSection({ campusId: null })).toThrow();
  });
});

describe('buildHalfTermSection', () => {
  it('runs the first half, 2027-01-11 to 2027-03-05, with an MWF 09:00 meeting in that half', () => {
    const section = buildHalfTermSection('first');

    expect([section.startsOn, section.endsOn, section.meetings]).toEqual([
      '2027-01-11',
      '2027-03-05',
      [{ ...MWF_0900_WHOLE_TERM, endsOn: '2027-03-05' }],
    ]);
  });

  it('runs the second half, 2027-03-08 to 2027-05-07, at the same meeting time', () => {
    const section = buildHalfTermSection('second', {}, 2);

    expect([section.id, section.startsOn, section.endsOn, section.meetings]).toEqual([
      'c0000000-0000-4000-8000-000000000002',
      '2027-03-08',
      '2027-05-07',
      [{ ...MWF_0900_WHOLE_TERM, startsOn: '2027-03-08' }],
    ]);
  });

  it('rejects a meeting outside the half-term section dates', () => {
    expect(() => buildHalfTermSection('first', { meetings: [MWF_0900_WHOLE_TERM] })).toThrow();
  });
});

describe('buildOnlineAsynchronousSection', () => {
  it('has no campus and no meetings, but still has the term dates', () => {
    const section = buildOnlineAsynchronousSection({}, 5);

    expect([section.modality, section.campusId, section.meetings, section.startsOn]).toEqual([
      'ONLINE_ASYNCHRONOUS',
      null,
      [],
      '2027-01-11',
    ]);
    expect(section.endsOn).toBe('2027-05-07');
  });

  it('rejects an asynchronous section with a timed meeting', () => {
    expect(() => buildOnlineAsynchronousSection({ meetings: [MWF_0900_WHOLE_TERM] })).toThrow();
  });
});
