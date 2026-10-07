/**
 * @file Plain-text wording for a section's modality, dates, and meetings, so a meeting is never
 * shown only on a calendar grid. Values are shown as the API returned them; a value still to be
 * announced is said so and never filled in.
 * @module @caa/web/features/schedule-options/utils/meeting-wording
 * @requirement FR-09
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { MeetingPattern } from '@caa/domain';

import { type CampusLookup, describeCampus } from '@/shared/utils/campus-display';
import { describeWeekday } from '@/shared/utils/section-wording';

const TO_BE_ANNOUNCED = 'to be announced';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

const TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
});

/**
 * Formats a calendar date.
 *
 * @param isoDate - A `YYYY-MM-DD` date.
 * @returns For example `Aug 24, 2026`.
 */
export function formatDate(isoDate: string): string {
  return DATE_FORMAT.format(new Date(`${isoDate}T00:00:00Z`));
}

/**
 * Formats a local clock time.
 *
 * @param time - An `HH:MM` time.
 * @returns For example `9:00 AM`.
 */
export function formatClockTime(time: string): string {
  return TIME_FORMAT.format(new Date(`1970-01-01T${time}:00Z`));
}

/**
 * Names the date range a section runs.
 *
 * @param startsOn - First date.
 * @param endsOn - Last date.
 * @returns For example `Aug 24, 2026 to Dec 11, 2026`.
 */
export function describeDateRange(startsOn: string, endsOn: string): string {
  return `${formatDate(startsOn)} to ${formatDate(endsOn)}`;
}

function describeLocation(location: MeetingPattern['location'], campuses: CampusLookup): string {
  if (location === null) {
    return `location ${TO_BE_ANNOUNCED}`;
  }
  if (location.kind === 'ONLINE') {
    return 'online';
  }
  const room = location.room === null ? '' : `, room ${location.room}`;
  return `campus ${describeCampus(location.campusId, campuses)}${room}`;
}

/**
 * Describes one meeting in words: days, time, dates, and place.
 *
 * @param meeting - The meeting from the API.
 * @param campuses - Campus names by ID, from the response.
 * @returns For example `Monday, Wednesday, 9:00 AM to 9:50 AM, Aug 24, 2026 to Dec 11, 2026,
 *   campus ...`.
 */
export function describeMeeting(meeting: MeetingPattern, campuses: CampusLookup): string {
  const days =
    meeting.weekdays === null
      ? `days ${TO_BE_ANNOUNCED}`
      : meeting.weekdays.map((day) => describeWeekday(day)).join(', ');
  const time =
    meeting.startTime === null || meeting.endTime === null
      ? `time ${TO_BE_ANNOUNCED}`
      : `${formatClockTime(meeting.startTime)} to ${formatClockTime(meeting.endTime)}`;
  const skipped =
    meeting.excludedDates.length === 0
      ? ''
      : `, not on ${meeting.excludedDates.map(formatDate).join(', ')}`;
  const dates = describeDateRange(meeting.startsOn, meeting.endsOn);
  return `${days}, ${time}, ${dates}${skipped}, ${describeLocation(meeting.location, campuses)}`;
}
