/**
 * @file Converts section meeting rows into meeting pattern domain objects.
 * @module @caa/db/mappers/meeting-pattern
 * @requirement FR-07
 */
import {
  createMeetingPattern,
  MeetingLocationKind,
  type MeetingPattern,
  type MeetingPatternInput,
} from '@caa/domain';

import type { SectionMeetingRow } from '../tables/section-meeting.table';

/**
 * Converts a stored `time` value to the domain's `HH:MM`.
 *
 * @param value - `HH:MM:SS` from the driver, or null when to be announced.
 * @returns `HH:MM`, or null. A value with seconds is returned whole, so the domain schema
 *   rejects it instead of the mapper silently dropping them.
 */
function toLocalTime(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  return value.length === 8 && value.endsWith(':00') ? value.slice(0, 5) : value;
}

/**
 * Rebuilds a meeting's location from its three columns.
 *
 * @param row - The meeting row.
 * @returns The location input, or null when to be announced.
 */
function toLocation(row: SectionMeetingRow): MeetingPatternInput['location'] {
  switch (row.locationKind) {
    case null:
      return null;
    case MeetingLocationKind.Online:
      return { kind: MeetingLocationKind.Online };
    case MeetingLocationKind.OnCampus:
      // NOTE: a null campus here fails the domain parse, as it should.
      return {
        kind: MeetingLocationKind.OnCampus,
        campusId: row.locationCampusId ?? '',
        room: row.room,
      };
  }
}

/**
 * Maps a meeting row to a validated domain object.
 *
 * @param row - Row read from the `section_meeting` table.
 * @returns The meeting pattern. A null weekday list, time or location stays null: to be
 *   announced, never "no meeting" and never midnight.
 * @throws {z.ZodError} When the stored meeting violates the domain schema.
 */
export function toMeetingPattern(row: SectionMeetingRow): MeetingPattern {
  return createMeetingPattern({
    weekdays: row.weekdays,
    startTime: toLocalTime(row.startTime),
    endTime: toLocalTime(row.endTime),
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    excludedDates: row.excludedDates,
    location: toLocation(row),
  });
}
