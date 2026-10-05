/**
 * @file Checks two sections' meetings against each other for time conflicts and campus travel.
 * @module @caa/engine/scheduling/find-meeting-conflicts
 * @requirement FR-07
 * @requirement FR-09
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import type { CampusTransitionPolicy, CheckResult, ScheduleIssue, Section } from '@caa/domain';

import { compareMeetings } from './compare-meetings';
import { type SectionMeeting, toMeetingComparisonIssue } from './meeting-comparison-issue';
import { toScheduleFeasibilityCheck } from './schedule-feasibility-check';
import { ScheduleInputError } from './schedule-input-error';

/** The two sections to compare and the tenant's campus transition table. */
export interface MeetingConflictInput {
  readonly first: Section;
  readonly second: Section;
  /**
   * The tenant's campus transition table from the pinned inputs, or `null` when the tenant has
   * none, so every pair of different campuses is undefined (UNKNOWN).
   */
  readonly transitionPolicy: CampusTransitionPolicy | null;
}

/**
 * Checks every meeting of one section against every meeting of another.
 *
 * Both sections come from one section snapshot, so their local times share its time zone and
 * are compared as wall-clock times on each shared calendar date; a daylight-saving change
 * never moves a meeting. For each pair of meetings:
 * - no possible date in common: no issue (AC07; GR-02);
 * - either time, or the days of an otherwise conflicting meeting, to be announced:
 *   UNKNOWN `MEETING_TIME_UNKNOWN`;
 * - half-open intervals overlapping: FAIL `MEETING_CONFLICT`;
 * - different campuses with no configured transition: UNKNOWN `TRANSITION_TIME_UNDEFINED`;
 * - a gap below the configured transition: FAIL `TRANSITION_TIME_INSUFFICIENT` (AC08);
 * - a location to be announced where travel matters: UNKNOWN `MEETING_LOCATION_UNKNOWN`.
 *
 * An online asynchronous section has no meetings, so it conflicts with nothing on time. The
 * sections are ordered by ID first, so swapping them gives a deep-equal result.
 *
 * @param input - The two sections and the transition table.
 * @returns A `SCHEDULE_FEASIBILITY` check: PASS, FAIL listing every FAIL issue, or UNKNOWN
 *   listing every UNKNOWN issue, in section-ID then meeting-index order.
 * @throws {ScheduleInputError} When both arguments are the same section (`sameSection`), or
 *   the sections or the transition table belong to different tenants (`tenantMismatch`).
 */
export function findMeetingConflicts(input: MeetingConflictInput): CheckResult {
  return toScheduleFeasibilityCheck(findMeetingIssues(input));
}

/**
 * Lists every schedule issue between two sections' meetings, as {@link findMeetingConflicts}
 * describes, so a caller can combine the issues of several section pairs into one check.
 *
 * @param input - The two sections and the transition table.
 * @returns Every FAIL and UNKNOWN issue, in section-ID then meeting-index order; empty when
 *   the sections are compatible.
 * @throws {ScheduleInputError} As {@link findMeetingConflicts} documents.
 */
export function findMeetingIssues(input: MeetingConflictInput): ScheduleIssue[] {
  const { first, second, transitionPolicy } = input;
  if (first.id === second.id) {
    throw new ScheduleInputError('sameSection');
  }
  // SAFETY: another tenant's sections or transition table would decide this tenant's schedule
  // with another institution's data (ADR-0010 §7: one pinned snapshot and table per request).
  if (
    first.tenantId !== second.tenantId ||
    (transitionPolicy !== null && transitionPolicy.tenantId !== first.tenantId)
  ) {
    throw new ScheduleInputError('tenantMismatch');
  }
  const [lower, upper] = first.id < second.id ? [first, second] : [second, first];
  return meetingsOf(lower).flatMap((one) =>
    meetingsOf(upper).flatMap((other): ScheduleIssue[] => {
      const comparison = compareMeetings(one.meeting, other.meeting, transitionPolicy);
      const issue = toMeetingComparisonIssue(comparison, one, other);
      return issue === null ? [] : [issue];
    }),
  );
}

/**
 * Lists a section's meetings with their positions.
 *
 * @param section - The section.
 * @returns Its meetings, in the section's order.
 */
function meetingsOf(section: Section): SectionMeeting[] {
  return section.meetings.map((meeting, meetingIndex) => ({
    sectionId: section.id,
    meetingIndex,
    meeting,
  }));
}
