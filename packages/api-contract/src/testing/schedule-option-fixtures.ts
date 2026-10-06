/**
 * @file Shared synthetic literals and builders for the schedule-options contract tests. Test
 *   support only: not exported from the package. Payloads are plain objects, parsed by the
 *   tests, so a test can also build invalid ones.
 * @module @caa/api-contract/testing/schedule-option-fixtures
 * @see docs/standards/07-testing.md
 */

import { namedCampusIds } from '../contracts/schedule-display.contract';

/** A JSON-like payload a test passes to a schema. */
export type Payload = Readonly<Record<string, unknown>>;

/** Synthetic course ID of DEMO-PHYS 301. */
export const PHYS_301 = 'c0a5e000-0000-4000-8000-000000000301';
/** Synthetic course ID of DEMO-PHYS 301L, the lab. */
export const PHYS_301L = 'c0a5e000-0000-4000-8000-000000003010';
/** Synthetic course ID of DEMO-CHEM 101. */
export const CHEM_101 = 'c0a5e000-0000-4000-8000-000000000101';

/** Synthetic term ID. */
export const TERM_ID = '92a3b4c5-0000-4000-8000-000000000003';
/** Synthetic campus ID. */
export const NORTH_CAMPUS_ID = 'c4a1b2c3-0000-4000-8000-000000000001';

/** The pinned ruleset version every fixture uses. */
export const RULESET_VERSION = 'demo-2026.1';

/**
 * Builds a synthetic section ID.
 *
 * @param seed - Distinguishes sections.
 * @returns A UUID whose last group is the seed.
 */
export function sectionId(seed: number): string {
  return `5ec71010-0000-4000-8000-${String(seed).padStart(12, '0')}`;
}

/** A Monday and Wednesday morning meeting on the North campus. */
export const MEETING: Payload = {
  weekdays: ['MONDAY', 'WEDNESDAY'],
  startTime: '09:00',
  endTime: '09:50',
  startsOn: '2026-08-24',
  endsOn: '2026-12-11',
  excludedDates: [],
  location: { kind: 'ON_CAMPUS', campusId: NORTH_CAMPUS_ID, room: null },
};

/** An in-person DEMO-PHYS 301 lecture section that counts its credits. */
export const LECTURE_SECTION: Payload = {
  sectionId: sectionId(1),
  courseId: PHYS_301,
  sectionCode: '001',
  modality: 'IN_PERSON',
  campusId: NORTH_CAMPUS_ID,
  startsOn: '2026-08-24',
  endsOn: '2026-12-11',
  meetings: [MEETING],
  countsCredits: true,
};

/** A DEMO-PHYS 301L lab section whose credits the lecture's total includes. */
export const LAB_SECTION: Payload = {
  ...LECTURE_SECTION,
  sectionId: sectionId(11),
  courseId: PHYS_301L,
  sectionCode: 'L01',
  meetings: [{ ...MEETING, weekdays: ['THURSDAY'], startTime: '14:00', endTime: '16:50' }],
  countsCredits: false,
};

/**
 * Builds an online asynchronous section with no meetings.
 *
 * @param courseId - The section's course.
 * @param id - The section ID.
 * @returns A scheduled-section payload.
 */
export function asyncSection(courseId: string, id: string): Payload {
  return {
    ...LECTURE_SECTION,
    sectionId: id,
    courseId,
    modality: 'ONLINE_ASYNCHRONOUS',
    campusId: null,
    meetings: [],
  };
}

/**
 * Builds a section bundle.
 *
 * @param courseId - The requested course.
 * @param sections - The primary section first, then linked sections.
 * @param credits - Credits counted in hundredths, or `null` when unknown.
 * @returns A bundle payload.
 */
export function bundleOf(
  courseId: string,
  sections: readonly Payload[],
  credits: number | null,
): Payload {
  return { courseId, sections, creditsCountedHundredths: credits };
}

/** The lecture with its linked lab, counting 4.00 credits. */
export const LECTURE_LAB_BUNDLE = bundleOf(PHYS_301, [LECTURE_SECTION, LAB_SECTION], 400);

/** A passing applicability check. */
export const PASS_APPLICABILITY: Payload = { kind: 'REQUIREMENT_APPLICABILITY', state: 'PASS' };
/** A passing allocation check. */
export const PASS_ALLOCATION: Payload = { kind: 'REQUIREMENT_ALLOCATION', state: 'PASS' };
/** A passing schedule-feasibility check. */
export const PASS_SCHEDULE: Payload = { kind: 'SCHEDULE_FEASIBILITY', state: 'PASS' };

/**
 * Builds an UNKNOWN schedule-feasibility check explained by one schedule issue.
 *
 * @param issue - The issue; its reason code becomes the check's.
 * @returns A schedule-feasibility check payload.
 */
function unknownScheduleWith(issue: Payload): Payload {
  return {
    kind: 'SCHEDULE_FEASIBILITY',
    state: 'UNKNOWN',
    reasonCode: issue.reasonCode,
    evidence: { rulesetVersion: null, decisiveLeaves: [], scheduleIssues: [issue] },
  };
}

/** An UNKNOWN schedule: the lecture's time is to be announced, beside a hard constraint. */
export const UNKNOWN_SCHEDULE = unknownScheduleWith({
  reasonCode: 'MEETING_TIME_UNKNOWN',
  meeting: {
    sectionId: sectionId(1),
    meetingIndex: 0,
    weekdays: null,
    startTime: null,
    endTime: null,
  },
  otherMeeting: null,
  sharedDates: null,
  constraintIndex: 0,
});

/** An UNKNOWN schedule for `unresolved`: DEMO-PHYS 301 has no published section. */
export const MISSING_SECTIONS = unknownScheduleWith({
  reasonCode: 'SECTION_DATA_MISSING',
  courseId: PHYS_301,
});

/** An UNKNOWN schedule for `unresolved`: a DEMO-PHYS 301 section lacks a linked section. */
export const LINKED_UNAVAILABLE = unknownScheduleWith({
  reasonCode: 'LINKED_SECTION_UNAVAILABLE',
  courseId: PHYS_301,
  primarySectionId: sectionId(1),
  componentName: 'Lab',
});

/** An UNKNOWN schedule left undecided by the credit load, which carries the arithmetic. */
export const UNKNOWN_LOAD_SCHEDULE: Payload = {
  kind: 'SCHEDULE_FEASIBILITY',
  state: 'UNKNOWN',
  reasonCode: 'VARIABLE_CREDIT_UNSELECTED',
};

/**
 * Builds a CREDIT_LOAD check with arithmetic, bounds 0 to 18.00 credits.
 *
 * @param total - Total credits in hundredths.
 * @param state - The check state; a FAIL is over the maximum.
 * @returns A credit-load check payload.
 */
export function creditLoadCheck(total: number, state: 'PASS' | 'FAIL' = 'PASS'): Payload {
  return {
    kind: 'CREDIT_LOAD',
    state,
    ...(state === 'FAIL' ? { reasonCode: 'CREDIT_LIMIT_EXCEEDED' } : {}),
    evidence: {
      rulesetVersion: RULESET_VERSION,
      decisiveLeaves: [],
      creditLoad: {
        totalCreditsHundredths: total,
        minCreditsHundredths: 0,
        maxCreditsHundredths: 1800,
      },
    },
  };
}

/** A credit load that can't be decided because a variable credit value wasn't chosen. */
export const UNKNOWN_CREDIT_LOAD: Payload = {
  kind: 'CREDIT_LOAD',
  state: 'UNKNOWN',
  reasonCode: 'VARIABLE_CREDIT_UNSELECTED',
};

/**
 * Builds a PREREQUISITE check with evidence under a ruleset.
 *
 * @param state - The check state.
 * @param rulesetVersion - The ruleset the check applied.
 * @returns A prerequisite check payload.
 */
export function prerequisiteCheck(state: string, rulesetVersion = RULESET_VERSION): Payload {
  const reasonCode: Readonly<Record<string, string>> = {
    FAIL: 'MIN_GRADE_NOT_MET',
    CONDITIONAL: 'IN_PROGRESS_MIN_GRADE',
  };
  return {
    kind: 'PREREQUISITE',
    state,
    ...(reasonCode[state] === undefined ? {} : { reasonCode: reasonCode[state] }),
    sourceRef: 'demo-rules:PHYS-301',
    evidence: { rulesetVersion, decisiveLeaves: [] },
  };
}

/** Fields {@link buildOption} can set; everything else follows from them. */
export interface OptionFields {
  readonly rank?: number;
  readonly bundles?: readonly Payload[];
  /** The courses with course results; defaults to the bundles' courses. */
  readonly courseIds?: readonly string[];
  readonly prerequisite?: Payload | null;
  readonly applicability?: Payload;
  readonly scheduleFeasibility?: Payload;
  /** Defaults to a PASS load whose total is the sum of the bundle credits. */
  readonly creditLoad?: Payload;
  readonly unmetPreferences?: readonly Payload[];
  /** Linked-course entries; defaults to none. */
  readonly linkedCourseResults?: readonly Payload[];
  readonly aggregate?: string;
}

/**
 * Builds a schedule option; by default the validated lecture-and-lab option.
 *
 * @param fields - Fields to set.
 * @returns An option payload.
 */
export function buildOption(fields: OptionFields = {}): Payload {
  const bundles = fields.bundles ?? [LECTURE_LAB_BUNDLE];
  const courseIds = fields.courseIds ?? bundles.map((bundle) => bundle.courseId);
  const total = bundles.reduce<number>(
    (sum, bundle) => sum + Number(bundle.creditsCountedHundredths ?? 0),
    0,
  );
  return {
    rank: fields.rank ?? 1,
    bundles,
    scheduleFeasibility: fields.scheduleFeasibility ?? PASS_SCHEDULE,
    courseResults: courseIds.map((courseId) => ({
      courseId,
      prerequisite: fields.prerequisite ?? null,
      applicability: fields.applicability ?? PASS_APPLICABILITY,
    })),
    linkedCourseResults: fields.linkedCourseResults ?? [],
    setResults: {
      allocation: [PASS_ALLOCATION],
      creditLoad: fields.creditLoad ?? creditLoadCheck(total),
    },
    unmetPreferences: fields.unmetPreferences ?? [],
    aggregate: fields.aggregate ?? 'VALIDATED',
  };
}

/**
 * Builds a DEMO-PHYS 301 bundle whose single async section is `sectionId(seed)`, counting 4.00.
 *
 * @param seed - Picks the section.
 * @returns A bundle payload.
 */
export function singleSectionBundle(seed: number): Payload {
  return bundleOf(PHYS_301, [asyncSection(PHYS_301, sectionId(seed))], 400);
}

/**
 * Builds a one-course option whose single async section is `sectionId(seed)`.
 *
 * @param rank - The option's rank.
 * @param seed - Picks the section, so options with different seeds are distinct.
 * @param isUnknown - `true` for an UNKNOWN schedule and a NEEDS_VERIFICATION aggregate.
 * @returns An option payload.
 */
export function singleSectionOption(rank: number, seed: number, isUnknown = false): Payload {
  return buildOption({
    rank,
    bundles: [singleSectionBundle(seed)],
    ...(isUnknown
      ? { scheduleFeasibility: UNKNOWN_SCHEDULE, aggregate: 'NEEDS_VERIFICATION' }
      : {}),
  });
}

/** The fixed limitation codes every response lists. */
export const LIMITATIONS = [
  'SEAT_AVAILABILITY_NOT_CHECKED',
  'REGISTRATION_READINESS_NOT_CHECKED',
  'NOT_REGISTERED',
] as const;

/** The requested term of a synthetic response. */
const SYNTHETIC_TERM: Payload = {
  id: TERM_ID,
  termCode: '2026FA',
  startsOn: '2026-08-24',
  endsOn: '2026-12-11',
};

/** Pinned inputs of a synthetic response. */
export const PINNED_INPUTS: Payload = {
  studentSnapshotId: '3c4d5e6f-0000-4000-8000-000000000001',
  studentRecordEffectiveAt: '2026-09-20T07:30:00.000-05:00',
  auditRecordEffectiveAt: '2026-09-20T07:15:00.000-05:00',
  auditSource: 'demo-audit',
  auditVersion: 'audit_demo_r7',
  rulesetVersion: RULESET_VERSION,
  sectionSnapshotId: '5a7b0000-0000-4000-8000-000000000001',
  campusTransitionVersion: RULESET_VERSION,
  solverWorkCap: 3_000_000,
  constraintHash: `sha256:${'0a'.repeat(32)}`,
};

/** A verified conflict: a credit load over the maximum. */
export const CREDIT_CONFLICT = creditLoadCheck(2000, 'FAIL');

/**
 * Builds a schedule-options response; by default `OPTIONS_FOUND` with one validated option.
 *
 * @param fields - Response fields to set.
 * @returns A response payload.
 */
export function buildResponse(fields: Payload = {}): Payload {
  const response: Payload = {
    outcome: 'OPTIONS_FOUND',
    searchComplete: true,
    courseIds: [PHYS_301],
    options: [singleSectionOption(1, 1)],
    conflictSet: null,
    unresolved: [],
    limitations: LIMITATIONS,
    pinnedInputs: PINNED_INPUTS,
    courses: [],
    term: SYNTHETIC_TERM,
    ...fields,
  };
  // Lists exactly the campuses the payload names, unless the caller sets `campuses`.
  const campuses = namedCampusIds(response as unknown as Parameters<typeof namedCampusIds>[0]).map(
    (id) => ({
      id,
      name: `Campus ${id.slice(-4)}`,
    }),
  );
  return { campuses, ...response };
}
