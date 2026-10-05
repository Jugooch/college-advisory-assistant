/**
 * @file Tests for checking a section against unavailable times, modalities and campuses.
 */
import { describe, expect, it } from 'vitest';

import { MeetingLocationKind, type MeetingPattern, SectionModality, Weekday } from '@caa/domain';
import {
  buildAllowedCampuses,
  buildAllowedModalities,
  buildCreditRange,
  buildMeetingPattern,
  buildSection,
  buildTbaMeeting,
  buildUnavailableTime,
  HARD_STRENGTH,
  SYNTHETIC_CAMPUSES,
} from '@caa/test-kit';

import { findSectionConstraintFindings } from './section-constraint-findings';

const { north, south } = SYNTHETIC_CAMPUSES;
const S1 = 'c0000000-0000-4000-8000-000000000001';
const MWF = ['MONDAY', 'WEDNESDAY', 'FRIDAY'];
/** Hard block: Friday 09:00–12:00. */
const FRIDAY_MORNING = buildUnavailableTime({
  ...HARD_STRENGTH,
  startTime: '09:00',
  endTime: '12:00',
});

/**
 * Checks a one-meeting section against the Friday-morning block.
 *
 * @param meeting - The section's meeting.
 * @returns The findings.
 */
function againstFridayMorning(
  meeting: MeetingPattern,
): ReturnType<typeof findSectionConstraintFindings> {
  return findSectionConstraintFindings(buildSection({ meetings: [meeting] }, 1), [FRIDAY_MORNING]);
}

describe('findSectionConstraintFindings unavailable times', () => {
  it('fails an MWF 09:00 meeting against a Friday-morning block, naming only Friday', () => {
    expect(againstFridayMorning(buildMeetingPattern())).toEqual([
      {
        constraintIndex: 0,
        sectionId: S1,
        isUnknown: false,
        meetingIndex: 0,
        issue: {
          reasonCode: 'UNAVAILABLE_TIME_CONFLICT',
          meeting: {
            sectionId: S1,
            meetingIndex: 0,
            weekdays: MWF,
            startTime: '09:00',
            endTime: '09:50',
          },
          constraintIndex: 0,
          weekdays: ['FRIDAY'],
          blockStartTime: '09:00',
          blockEndTime: '12:00',
        },
      },
    ]);
  });

  it('passes a meeting that ends exactly when the block starts (half-open)', () => {
    expect(
      againstFridayMorning(buildMeetingPattern({ startTime: '08:00', endTime: '09:00' })),
    ).toEqual([]);
  });

  it('passes a meeting on none of the block days, whatever its time', () => {
    expect(againstFridayMorning(buildTbaMeeting({ weekdays: [Weekday.Tuesday] }))).toEqual([]);
  });

  it('passes a meeting that never occurs on its own dates', () => {
    const empty = buildMeetingPattern({
      weekdays: [Weekday.Monday],
      startsOn: '2027-01-12',
      endsOn: '2027-01-12',
    });

    expect(againstFridayMorning(empty)).toEqual([]);
  });

  it('is UNKNOWN MEETING_TIME_UNKNOWN for a TBA time on a block day, never PASS', () => {
    expect(againstFridayMorning(buildTbaMeeting({ weekdays: [Weekday.Friday] }))).toMatchObject([
      {
        isUnknown: true,
        issue: { reasonCode: 'MEETING_TIME_UNKNOWN', constraintIndex: 0, otherMeeting: null },
      },
    ]);
  });

  it('is UNKNOWN, never FAIL, for TBA days whose time falls in the block', () => {
    const tbaDays = buildMeetingPattern({ weekdays: null });

    expect(againstFridayMorning(tbaDays)).toMatchObject([
      { isUnknown: true, issue: { reasonCode: 'MEETING_TIME_UNKNOWN' } },
    ]);
  });

  it('passes TBA days whose time misses the block', () => {
    expect(
      againstFridayMorning(
        buildMeetingPattern({ weekdays: null, startTime: '13:00', endTime: '13:50' }),
      ),
    ).toEqual([]);
  });
});

describe('findSectionConstraintFindings campuses and modalities', () => {
  const campuses = buildAllowedCampuses({ campusIds: [north.id] });

  it('fails a meeting on a campus the student does not allow', () => {
    const meeting = buildMeetingPattern({
      location: { kind: MeetingLocationKind.OnCampus, campusId: south.id, room: null },
    });

    expect(
      findSectionConstraintFindings(buildSection({ meetings: [meeting] }, 1), [campuses]),
    ).toMatchObject([
      {
        isUnknown: false,
        meetingIndex: 0,
        issue: { reasonCode: 'CAMPUS_NOT_ALLOWED', campusId: south.id },
      },
    ]);
  });

  it('passes a meeting on an allowed campus', () => {
    expect(findSectionConstraintFindings(buildSection({}, 1), [campuses])).toEqual([]);
  });

  it('passes an online meeting, which no campus constraint applies to', () => {
    const online = buildSection(
      {
        modality: SectionModality.OnlineSynchronous,
        campusId: null,
        meetings: [buildMeetingPattern({ location: { kind: MeetingLocationKind.Online } })],
      },
      1,
    );

    expect(findSectionConstraintFindings(online, [campuses])).toEqual([]);
  });

  it('is UNKNOWN MEETING_LOCATION_UNKNOWN for a TBA location, never PASS', () => {
    const tba = buildSection({ meetings: [buildMeetingPattern({ location: null })] }, 1);

    expect(findSectionConstraintFindings(tba, [campuses])).toMatchObject([
      { isUnknown: true, issue: { reasonCode: 'MEETING_LOCATION_UNKNOWN', constraintIndex: 0 } },
    ]);
  });

  it('fails a modality the student does not allow, naming the section only', () => {
    const modalities = buildAllowedModalities({ modalities: [SectionModality.Hybrid] });

    expect(findSectionConstraintFindings(buildSection({}, 1), [modalities])).toEqual([
      {
        constraintIndex: 0,
        sectionId: S1,
        isUnknown: false,
        meetingIndex: null,
        issue: {
          reasonCode: 'MODALITY_NOT_ALLOWED',
          sectionId: S1,
          modality: 'IN_PERSON',
          constraintIndex: 0,
        },
      },
    ]);
  });

  it('passes an allowed modality, and leaves credit ranges to the whole option', () => {
    expect(
      findSectionConstraintFindings(buildSection({}, 1), [
        buildAllowedModalities(),
        buildCreditRange(),
      ]),
    ).toEqual([]);
  });
});
