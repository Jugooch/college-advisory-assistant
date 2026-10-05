/**
 * @file Checks one section against the student's time, modality and campus constraints.
 * @module @caa/engine/scheduling/section-constraint-findings
 * @requirement FR-07
 * @requirement FR-08
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import {
  createScheduleIssue,
  doLocalTimeRangesOverlap,
  MeetingLocationKind,
  ReasonCode,
  type ScheduleConstraint,
  ScheduleConstraintKind,
  type ScheduleIssue,
  type Section,
  type SectionId,
} from '@caa/domain';

import { type SectionMeeting, toMeetingTimeRef } from './meeting-comparison-issue';
import { findSharedMeetingDates } from './shared-meeting-dates';

/** One place where a section misses a constraint, or can't be checked against it. */
export interface ConstraintFinding {
  readonly constraintIndex: number;
  /** The section that misses it. */
  readonly sectionId: SectionId;
  /** `true` when missing data leaves it undecided (UNKNOWN); `false` when it is missed (FAIL). */
  readonly isUnknown: boolean;
  /** The meeting that misses it, or `null` when the section as a whole does. */
  readonly meetingIndex: number | null;
  /** The structured evidence. */
  readonly issue: ScheduleIssue;
}

/** A time block the student can't attend. */
type UnavailableTime = Extract<
  ScheduleConstraint,
  { readonly kind: typeof ScheduleConstraintKind.UnavailableTime }
>;

/**
 * Checks a section against every time, modality and campus constraint, whatever its strength.
 * Credit ranges apply to a whole option, so they aren't checked here.
 *
 * @param section - The section.
 * @param constraints - The request's constraints, in the student's order.
 * @returns Every finding, in constraint then meeting order; empty when the section meets all.
 */
export function findSectionConstraintFindings(
  section: Section,
  constraints: readonly ScheduleConstraint[],
): ConstraintFinding[] {
  const meetings = section.meetings.map((meeting, meetingIndex): SectionMeeting => ({
    sectionId: section.id,
    meetingIndex,
    meeting,
  }));
  return constraints.flatMap((constraint, constraintIndex): ConstraintFinding[] => {
    switch (constraint.kind) {
      case ScheduleConstraintKind.UnavailableTime:
        return meetings.flatMap((entry) =>
          unavailableTimeFinding(entry, constraint, constraintIndex),
        );
      case ScheduleConstraintKind.AllowedCampuses:
        return meetings.flatMap((entry) =>
          campusFinding(entry, constraint.campusIds, constraintIndex),
        );
      case ScheduleConstraintKind.AllowedModalities:
        return constraint.modalities.includes(section.modality)
          ? []
          : [modalityFinding(section, constraintIndex)];
      case ScheduleConstraintKind.CreditRange:
        return [];
    }
  });
}

/**
 * Checks one meeting against a time block the student can't attend.
 *
 * @param entry - The meeting and where it sits.
 * @param block - The time block.
 * @param constraintIndex - The block's index in the request.
 * @returns A finding, or none when the meeting never falls in the block.
 */
function unavailableTimeFinding(
  entry: SectionMeeting,
  block: UnavailableTime,
  constraintIndex: number,
): ConstraintFinding[] {
  const { meeting } = entry;
  const ownDates = findSharedMeetingDates(meeting, meeting);
  const days = (ownDates?.weekdays ?? []).filter((day) => block.weekdays.includes(day));
  // SAFETY: a meeting that never occurs on one of the block's days can't fall in it, whatever
  // its time (planning/08 §Schedule model: both dates and instances must overlap).
  if (days.length === 0) {
    return [];
  }
  const { startTime, endTime } = meeting;
  const blockRange = { startTime: block.startTime, endTime: block.endTime };
  const isTimed = startTime !== null && endTime !== null;
  if (isTimed && !doLocalTimeRangesOverlap({ startTime, endTime }, blockRange)) {
    return [];
  }
  // SAFETY: an unknown time never satisfies a hard availability constraint, and a meeting whose
  // days are to be announced can't prove it falls in the block either, so both are UNKNOWN,
  // never PASS and never FAIL (planning/08 §Schedule model; GR-02; ADR-0010 §3).
  if (!isTimed || meeting.weekdays === null) {
    return [unknownFinding(entry, constraintIndex, ReasonCode.MeetingTimeUnknown)];
  }
  const issue = createScheduleIssue({
    reasonCode: ReasonCode.UnavailableTimeConflict,
    meeting: toMeetingTimeRef(entry),
    constraintIndex,
    weekdays: days,
    blockStartTime: block.startTime,
    blockEndTime: block.endTime,
  });
  return [
    {
      constraintIndex,
      sectionId: entry.sectionId,
      isUnknown: false,
      meetingIndex: entry.meetingIndex,
      issue,
    },
  ];
}

/**
 * Checks one meeting's campus against the campuses the student allows.
 *
 * @param entry - The meeting and where it sits.
 * @param campusIds - The allowed campuses.
 * @param constraintIndex - The constraint's index in the request.
 * @returns A finding, or none when the meeting is online or on an allowed campus.
 */
function campusFinding(
  entry: SectionMeeting,
  campusIds: readonly string[],
  constraintIndex: number,
): ConstraintFinding[] {
  const { location } = entry.meeting;
  // SAFETY: a location to be announced never satisfies a hard campus constraint, so it is
  // UNKNOWN, never PASS (ADR-0010 §3 and Amendment 2).
  if (location === null) {
    return [unknownFinding(entry, constraintIndex, ReasonCode.MeetingLocationUnknown)];
  }
  // SAFETY: an online meeting has no campus, so a campus constraint doesn't apply to it.
  if (location.kind === MeetingLocationKind.Online || campusIds.includes(location.campusId)) {
    return [];
  }
  const issue = createScheduleIssue({
    reasonCode: ReasonCode.CampusNotAllowed,
    sectionId: entry.sectionId,
    meetingIndex: entry.meetingIndex,
    campusId: location.campusId,
    constraintIndex,
  });
  return [
    {
      constraintIndex,
      sectionId: entry.sectionId,
      isUnknown: false,
      meetingIndex: entry.meetingIndex,
      issue,
    },
  ];
}

/**
 * Builds the finding for a section whose modality the student doesn't allow.
 *
 * @param section - The section.
 * @param constraintIndex - The constraint's index in the request.
 * @returns The finding.
 */
function modalityFinding(section: Section, constraintIndex: number): ConstraintFinding {
  const issue = createScheduleIssue({
    reasonCode: ReasonCode.ModalityNotAllowed,
    sectionId: section.id,
    modality: section.modality,
    constraintIndex,
  });
  return { constraintIndex, sectionId: section.id, isUnknown: false, meetingIndex: null, issue };
}

/**
 * Builds the finding for a meeting whose time or location is to be announced.
 *
 * @param entry - The meeting and where it sits.
 * @param constraintIndex - The constraint it couldn't be checked against.
 * @param reasonCode - `MEETING_TIME_UNKNOWN` or `MEETING_LOCATION_UNKNOWN`.
 * @returns The UNKNOWN finding.
 */
function unknownFinding(
  entry: SectionMeeting,
  constraintIndex: number,
  reasonCode: typeof ReasonCode.MeetingTimeUnknown | typeof ReasonCode.MeetingLocationUnknown,
): ConstraintFinding {
  const issue = createScheduleIssue({
    reasonCode,
    meeting: toMeetingTimeRef(entry),
    otherMeeting: null,
    sharedDates: null,
    constraintIndex,
  });
  return {
    constraintIndex,
    sectionId: entry.sectionId,
    isUnknown: true,
    meetingIndex: entry.meetingIndex,
    issue,
  };
}
