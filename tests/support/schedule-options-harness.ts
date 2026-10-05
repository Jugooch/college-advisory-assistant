/**
 * @file Shared world, sections, and requests for the schedule-options acceptance cases (AC06 to
 * AC08, AC12, AC32 to AC34):`POST /v1/students/:studentId/schedule-options`. The default world is
 * the academic one (a fresh record and audit) with DEMO-MATH 101 passed with a B, an audit that
 * lists DEMO-MATH 102 and DEMO-PHYS 201, and no published sections, so each case states only the
 * sections and transitions it is about.
 * @module @caa/tests/support/schedule-options-harness
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import type {
  CampusTransition,
  CourseAttempt,
  LinkedSectionGroup,
  ScheduleConstraintSetInput,
  Section,
} from '@caa/domain';
import {
  buildCampusTransitionPolicy,
  buildSectionSnapshot,
  completedAttempt,
  SYNTHETIC_COURSES,
  SYNTHETIC_SCHEDULE_TERM,
} from '@caa/test-kit';

import {
  ACADEMIC_STUDENT_ID,
  type AcademicRequestAs,
  resetAcademicWorld,
} from './academic-endpoints-harness';
import {
  type AcceptanceApp,
  type AcceptanceResponse,
  type AcceptanceWorld,
  postAs,
} from './api-harness';

const { math102, phys201 } = SYNTHETIC_COURSES;

/** The passed prerequisite of DEMO-MATH 102: DEMO-MATH 101 with a B, attempt seed 1. */
export const MATH101_B = completedAttempt();

/**
 * When the default section snapshot took effect: seven hours before the harness clock
 * (2026-09-01T12:00Z), inside the 24-hour maximum age.
 */
export const SECTIONS_AT = '2026-09-01T05:00:00.000Z';

/** What a case varies in the schedule world. */
export interface ScheduleScenario {
  /** Attempts the pinned record lists; DEMO-MATH 101 with a B by default. */
  readonly attempts?: readonly CourseAttempt[];
}

/**
 * Resets the world: the academic defaults with DEMO-MATH 101 passed with a B, one outstanding
 * requirement listing DEMO-MATH 102 and DEMO-PHYS 201 with room for both (7.00 credits, two
 * courses), no section snapshot, and no campus transition table.
 *
 * @param world - The world to reset.
 * @param scenario - What the case varies.
 */
export function resetScheduleWorld(world: AcceptanceWorld, scenario: ScheduleScenario = {}): void {
  resetAcademicWorld(world, {
    attempts: scenario.attempts ?? [MATH101_B],
    requirements: [
      {
        candidateCourseIds: [math102.id, phys201.id],
        remainingCourseCount: 2,
        remainingCreditsHundredths: 700,
      },
    ],
  });
  world.sectionSnapshots = [];
  world.campusTransitionPolicies = [];
}

/**
 * Publishes one section snapshot of `SYNTHETIC_SCHEDULE_TERM` (2027SP) in tenant A, replacing any
 * other.
 *
 * @param world - The world.
 * @param sections - The snapshot's sections.
 * @param options - Linked-section groups and the snapshot's source time.
 * @param options.linkedSectionGroups - Groups among the sections; none by default.
 * @param options.sourceEffectiveAt - When the feed took effect; {@link SECTIONS_AT} by default.
 */
export function publishSections(
  world: AcceptanceWorld,
  sections: readonly Section[],
  {
    linkedSectionGroups = [],
    sourceEffectiveAt = SECTIONS_AT,
  }: {
    readonly linkedSectionGroups?: readonly LinkedSectionGroup[];
    readonly sourceEffectiveAt?: string;
  } = {},
): void {
  world.sectionSnapshots = [
    buildSectionSnapshot({ sections, linkedSectionGroups, sourceEffectiveAt }),
  ];
}

/**
 * Publishes tenant A's campus transition table, version `demo-2026.1`, with the given pairs.
 *
 * @param world - The world.
 * @param transitions - The ordered campus pairs the institution supplied.
 */
export function publishTransitions(
  world: AcceptanceWorld,
  transitions: readonly CampusTransition[],
): void {
  world.campusTransitionPolicies = [buildCampusTransitionPolicy({ transitions })];
}

/**
 * Builds a request body for `SYNTHETIC_SCHEDULE_TERM`, with no credit selections.
 *
 * @param courseIds - The required courses.
 * @param constraints - The student's constraints; none by default.
 * @returns The JSON body.
 */
export function scheduleRequest(
  courseIds: readonly string[],
  constraints: ScheduleConstraintSetInput = [],
): object {
  return { termId: SYNTHETIC_SCHEDULE_TERM.termId, courseIds, creditSelections: [], constraints };
}

/**
 * Requests schedule options.
 *
 * @param app - App under test.
 * @param payload - The JSON body.
 * @param as - Actor and student; the student reading their own record by default.
 * @returns The response.
 */
export function findScheduleOptions(
  app: AcceptanceApp,
  payload: object,
  { actor = 'student', studentId = ACADEMIC_STUDENT_ID }: AcademicRequestAs = {},
): Promise<AcceptanceResponse> {
  return postAs(app, {
    url: `/v1/students/${studentId}/schedule-options`,
    authorization: `Bearer academic-${actor}`,
    payload,
  });
}

/** A meeting an issue names, read as plain JSON. */
interface MeetingRefView {
  readonly sectionId?: string;
}

/** The parts of a schedule issue the cases compare, read as plain JSON. */
export interface ScheduleIssueView {
  readonly reasonCode?: string;
  readonly first?: MeetingRefView;
  readonly second?: MeetingRefView;
  readonly earlier?: MeetingRefView;
  readonly later?: MeetingRefView;
  readonly meeting?: MeetingRefView;
  readonly otherMeeting?: MeetingRefView | null;
  readonly [field: string]: unknown;
}

/** A check result, read as plain JSON. */
interface CheckView {
  readonly evidence?: { readonly scheduleIssues?: readonly ScheduleIssueView[] };
}

/**
 * Reads the response's `data`, or an empty object when there is none.
 *
 * @param response - The response.
 * @returns The data object.
 */
function dataOf(response: AcceptanceResponse): Record<string, unknown> {
  const body = response.body as { data?: Record<string, unknown> } | null;
  return body?.data ?? {};
}

/**
 * Reads one field of the response's `pinnedInputs`.
 *
 * @param response - The response.
 * @param field - The pinned field, for example `constraintHash`.
 * @returns Its value, or `undefined` when the response pins nothing.
 */
export function pinnedField(response: AcceptanceResponse, field: string): unknown {
  const pinned = dataOf(response).pinnedInputs as Record<string, unknown> | null | undefined;
  return pinned?.[field];
}

/**
 * Lists the response's limitation codes, sorted, whatever order the API put them in.
 *
 * @param response - The response.
 * @returns The sorted codes; empty when there are none.
 */
export function sortedLimitations(response: AcceptanceResponse): readonly string[] {
  const { limitations } = dataOf(response);
  return Array.isArray(limitations) ? limitations.map(String).sort() : [];
}

/**
 * Lists the weekdays an issue's shared dates fall on, sorted, whatever order the engine put
 * them in.
 *
 * @param issue - The issue.
 * @returns The sorted weekdays; empty when the issue shows no shared dates.
 */
export function sharedWeekdays(issue: ScheduleIssueView): readonly string[] {
  const shared = issue.sharedDates as { readonly weekdays?: unknown } | null | undefined;
  return Array.isArray(shared?.weekdays) ? shared.weekdays.map(String).sort() : [];
}

/**
 * Lists the schedule issues of every `conflictSet` item, in item order.
 *
 * @param response - The response.
 * @returns The issues; empty when there is no conflict set.
 */
export function conflictIssues(response: AcceptanceResponse): readonly ScheduleIssueView[] {
  const conflictSet = dataOf(response).conflictSet as { items?: readonly CheckView[] } | null;
  return (conflictSet?.items ?? []).flatMap((item) => item.evidence?.scheduleIssues ?? []);
}

/**
 * Lists the schedule issues of one option's `scheduleFeasibility` check.
 *
 * @param response - The response.
 * @param rank - The option's rank, 1 first.
 * @returns The issues; empty when the option or its evidence is missing.
 */
export function optionIssues(
  response: AcceptanceResponse,
  rank: number,
): readonly ScheduleIssueView[] {
  const options = (dataOf(response).options ?? []) as readonly {
    scheduleFeasibility?: CheckView;
  }[];
  return options[rank - 1]?.scheduleFeasibility?.evidence?.scheduleIssues ?? [];
}

/**
 * Reads every option's course result for one course, whatever order `courseResults` is in.
 *
 * @param response - The response.
 * @param courseId - The requested course.
 * @returns One course result per option, in rank order; `undefined` where it is missing.
 */
export function courseResultsOf(
  response: AcceptanceResponse,
  courseId: string,
): readonly unknown[] {
  const options = (dataOf(response).options ?? []) as readonly {
    courseResults?: readonly { courseId?: string }[];
  }[];
  return options.map((option) =>
    (option.courseResults ?? []).find((result) => result.courseId === courseId),
  );
}

/**
 * Lists the sections an issue names, sorted, whatever order the engine put them in.
 *
 * @param issue - The issue.
 * @returns The section IDs of its two meetings, or of its one meeting.
 */
export function issueSectionIds(issue: ScheduleIssueView): readonly string[] {
  return [
    issue.first,
    issue.second,
    issue.earlier,
    issue.later,
    issue.meeting,
    issue.otherMeeting ?? undefined,
  ]
    .flatMap((ref) => (ref?.sectionId === undefined ? [] : [ref.sectionId]))
    .sort();
}

/**
 * Lists each option's section IDs, sorted, so options compare whatever order the bundles are in.
 *
 * @param response - The response.
 * @returns One sorted list of section IDs per option, in rank order.
 */
export function optionSectionSets(response: AcceptanceResponse): readonly (readonly string[])[] {
  return optionSectionIds(response).map((ids) => [...ids].sort());
}

/**
 * Lists each option's section IDs, in bundle and section order, reading the response as plain
 * JSON. A missing field reads as empty, so a malformed response fails the case's comparison.
 *
 * @param response - The response.
 * @returns One list of section IDs per option, in rank order.
 */
export function optionSectionIds(response: AcceptanceResponse): readonly (readonly string[])[] {
  const { options: raw } = dataOf(response);
  const options: readonly unknown[] = Array.isArray(raw) ? raw : [];
  return options.map((option) => {
    const bundles = (option as { bundles?: unknown }).bundles;
    return (Array.isArray(bundles) ? bundles : []).flatMap((bundle) => {
      const sections = (bundle as { sections?: unknown }).sections;
      return (Array.isArray(sections) ? sections : []).map(
        (section) => (section as { sectionId?: string }).sectionId ?? '',
      );
    });
  });
}
