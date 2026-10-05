/**
 * @file Factories for section-pair meeting-conflict golden cases (#218): the two sections and the
 *   transition table, the expected `SCHEDULE_FEASIBILITY` check with its issues, and the case
 *   with the S4 adjudication defaults. Every expected value is written by the adjudicator.
 * @module @caa/test-kit/golden/golden-meeting-conflict-factories
 * @requirement FR-07
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { type CampusTransition, CheckKind, CheckState, type Section } from '@caa/domain';

import { buildCampusTransitionPolicy } from '../builders/campus-transition-policy.builder';
import { defineGoldenCase, type GoldenCase, type GoldenCaseInput } from './golden-case.schema';
import type { ExpectedCheckInput } from './golden-expectation.schema';
import { SCHEDULE_REVIEW, SCHEDULE_SOURCES } from './golden-schedule-factories';
import type { ExpectedScheduleIssueInput } from './golden-schedule-issue.schema';

/** Input of a meeting-conflict case, as the schema accepts it. */
type MeetingCaseInput = Extract<GoldenCaseInput, { check: 'SCHEDULE_FEASIBILITY' }>;

/** A meeting-conflict case as written: the format's defaults may be left out. */
type AuthoredMeetingCase = Omit<
  MeetingCaseInput,
  'check' | 'sourceVersions' | 'reviewer' | 'adjudicatedOn' | 'allowedAlternatives'
> &
  Partial<Pick<MeetingCaseInput, 'allowedAlternatives' | 'sourceVersions'>>;

/**
 * Builds the inputs of a section-pair case.
 *
 * @param first - One section.
 * @param second - The other section.
 * @param transitions - The tenant A table's pairs, or `null` for no table; an empty table by
 *   default.
 * @returns The inputs.
 */
export function meetingInputs(
  first: Section,
  second: Section,
  transitions: readonly CampusTransition[] | null = [],
): MeetingCaseInput['inputs'] {
  return {
    first,
    second,
    transitionPolicy: transitions === null ? null : buildCampusTransitionPolicy({ transitions }),
  };
}

/** The expected check when no meeting pair conflicts, needs travel, or is unknown. */
export const MEETING_PASS: ExpectedCheckInput = {
  kind: CheckKind.ScheduleFeasibility,
  state: CheckState.Pass,
  reasonCode: null,
};

/**
 * Builds an expected non-PASS check whose reason is its first, decisive issue.
 *
 * @param state - FAIL or UNKNOWN.
 * @param issues - The issues, in the engine's section-ID then meeting-index order.
 * @returns The expected check.
 */
export function meetingCheck(
  state: CheckState,
  issues: readonly [ExpectedScheduleIssueInput, ...ExpectedScheduleIssueInput[]],
): ExpectedCheckInput {
  return {
    kind: CheckKind.ScheduleFeasibility,
    state,
    reasonCode: issues[0].reasonCode,
    evidence: { scheduleIssues: issues },
  };
}

/**
 * Validates a section-pair meeting-conflict case written with the S4 adjudication defaults.
 *
 * @param authored - The case.
 * @returns The validated case.
 */
export function meetingConflictCase(authored: AuthoredMeetingCase): GoldenCase {
  return defineGoldenCase({
    allowedAlternatives: [],
    sourceVersions: [...SCHEDULE_SOURCES],
    ...SCHEDULE_REVIEW,
    ...authored,
    check: CheckKind.ScheduleFeasibility,
  });
}
