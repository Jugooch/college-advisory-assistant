/**
 * @file Tests that every scheduling reason code renders from the fixed wording, as a verified
 * conflict, a needs-verification option, or an unresolved item.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { ScheduleOptionsResponse } from '@caa/api-contract';
import { type CheckResult, ReasonCode } from '@caa/domain';
import {
  buildCheckResult,
  buildScheduledSection,
  buildScheduleOption,
  buildScheduleOptionsResponse,
  buildSection,
  buildSectionBundle,
  buildTbaMeeting,
  SYNTHETIC_CAMPUSES,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import { indexCourses } from '@/shared/utils/course-display';
import { describeReason } from '@/shared/utils/reason-code-wording';

import { ScheduleResults } from './schedule-results';

const { phys201, phys201Lab } = SYNTHETIC_COURSES;
const BANNED = /registered|enrolled|approved/i;

const LECTURE = buildSection({ courseId: phys201.id }, 1);
const LAB_SECTION = buildSection({ courseId: phys201Lab.id, meetings: [buildTbaMeeting()] }, 2);
const BUNDLE = buildSectionBundle([LECTURE, buildScheduledSection(LAB_SECTION, false)], 400);

/**
 * Renders a response over the lecture and lab as the page would.
 *
 * @param overrides - Response fields to replace.
 * @returns The markup.
 */
function render(overrides: Partial<ScheduleOptionsResponse> = {}): string {
  const options = overrides.options ?? [buildScheduleOption({ bundles: [BUNDLE] })];
  const result = buildScheduleOptionsResponse({
    courseIds: [phys201.id],
    ...overrides,
    options,
  });
  return renderToStaticMarkup(<ScheduleResults result={result} courses={indexCourses([])} />);
}

/**
 * Visible words only: the contract's limitation codes are shown verbatim in `<code>`.
 *
 * @param html - The rendered markup.
 * @returns The markup without code elements.
 */
function words(html: string): string {
  return html.replace(/<code>.*?<\/code>/g, '');
}

const NORTH = SYNTHETIC_CAMPUSES.north.id;
const SOUTH = SYNTHETIC_CAMPUSES.south.id;

/**
 * Builds a meeting reference for a schedule issue.
 *
 * @param index - The meeting index.
 * @param startTime - Start, or null.
 * @param endTime - End, or null.
 * @returns The reference.
 */
function ref(index: number, startTime: string | null, endTime: string | null) {
  const weekdays = startTime === null ? null : (['MONDAY'] as const);
  return { sectionId: LECTURE.id, meetingIndex: index, weekdays, startTime, endTime };
}

const SHARED = { firstDate: '2026-08-24', lastDate: '2026-12-11', weekdays: ['MONDAY'] } as const;

const TRANSITION = {
  earlier: ref(0, '09:00', '09:50'),
  later: ref(1, '10:00', '10:50'),
  sharedDates: SHARED,
  fromCampusId: NORTH,
  toCampusId: SOUTH,
  availableMinutes: 10,
} as const;

/**
 * Builds a schedule check with one issue of the given reason code.
 *
 * @param code - The reason code.
 * @param state - The check state that code implies.
 * @returns The check.
 */
function scheduleCheck(code: string, state: 'FAIL' | 'UNKNOWN'): CheckResult {
  const issues: Readonly<Record<string, object>> = {
    MEETING_CONFLICT: {
      first: ref(0, '09:00', '09:50'),
      second: ref(1, '09:30', '10:20'),
      sharedDates: SHARED,
    },
    TRANSITION_TIME_INSUFFICIENT: { ...TRANSITION, requiredMinutes: 20 },
    TRANSITION_TIME_UNDEFINED: { ...TRANSITION, requiredMinutes: null },
    MEETING_TIME_UNKNOWN: {
      meeting: ref(0, null, null),
      otherMeeting: null,
      sharedDates: null,
      constraintIndex: 0,
    },
    MEETING_LOCATION_UNKNOWN: {
      meeting: ref(0, '09:00', '09:50'),
      otherMeeting: ref(1, '10:00', '10:50'),
      sharedDates: SHARED,
      constraintIndex: null,
    },
    UNAVAILABLE_TIME_CONFLICT: {
      meeting: ref(0, '09:00', '09:50'),
      constraintIndex: 0,
      weekdays: ['MONDAY'],
      blockStartTime: '08:00',
      blockEndTime: '10:00',
    },
    MODALITY_NOT_ALLOWED: { sectionId: LECTURE.id, modality: 'IN_PERSON', constraintIndex: 0 },
    CAMPUS_NOT_ALLOWED: {
      sectionId: LECTURE.id,
      meetingIndex: 0,
      campusId: NORTH,
      constraintIndex: 0,
    },
    LINKED_SECTION_UNAVAILABLE: {
      primarySectionId: LECTURE.id,
      componentName: 'Lab',
      courseId: phys201.id,
    },
    SECTION_DATA_MISSING: { courseId: phys201.id },
  };
  return buildCheckResult({
    kind: 'SCHEDULE_FEASIBILITY',
    state,
    reasonCode: code as ReasonCode,
    evidence: {
      rulesetVersion: null,
      decisiveLeaves: [],
      scheduleIssues: [{ reasonCode: code, ...issues[code] }] as never,
    },
  });
}

const FAIL_CODES = [
  ReasonCode.MeetingConflict,
  ReasonCode.TransitionTimeInsufficient,
  ReasonCode.UnavailableTimeConflict,
  ReasonCode.ModalityNotAllowed,
  ReasonCode.CampusNotAllowed,
];

const UNKNOWN_CODES = [
  ReasonCode.TransitionTimeUndefined,
  ReasonCode.MeetingTimeUnknown,
  ReasonCode.MeetingLocationUnknown,
];

describe('ScheduleResults scheduling reason codes', () => {
  it.each(FAIL_CODES)('renders the verified conflict %s from the fixed wording', (code) => {
    const html = render({
      outcome: 'NO_FEASIBLE_PLAN',
      options: [],
      conflictSet: { items: [scheduleCheck(code, 'FAIL')], isMinimal: false, omittedCount: 0 },
    });
    expect(html).toContain(describeReason(code).explanation);
    expect(html).toContain(describeReason(code).nextStep);
    expect(words(html)).not.toMatch(BANNED);
  });

  it.each(UNKNOWN_CODES)('renders %s on an option as needing verification', (code) => {
    const html = render({
      options: [
        buildScheduleOption({
          bundles: [BUNDLE],
          scheduleFeasibility: scheduleCheck(code, 'UNKNOWN'),
          aggregate: 'NEEDS_VERIFICATION',
        }),
      ],
    });
    expect(html).toContain(describeReason(code).explanation);
    expect(html).toContain(describeReason(code).nextStep);
    expect(html).not.toContain('Validated for the listed checks only');
  });

  it.each([ReasonCode.LinkedSectionUnavailable, ReasonCode.SectionDataMissing])(
    'renders %s among the unresolved items',
    (code) => {
      const html = render({
        outcome: 'NEEDS_VERIFICATION',
        options: [],
        searchComplete: false,
        unresolved: [scheduleCheck(code, 'UNKNOWN')],
      });
      expect(html).toContain(describeReason(code).explanation);
      expect(words(html)).not.toMatch(BANNED);
    },
  );

  it('renders a credit limit conflict from the fixed wording', () => {
    const load = buildCheckResult({
      kind: 'CREDIT_LOAD',
      state: 'FAIL',
      reasonCode: 'CREDIT_LIMIT_EXCEEDED',
      evidence: {
        rulesetVersion: 'demo-2026.1',
        decisiveLeaves: [],
        creditLoad: {
          totalCreditsHundredths: 2000,
          minCreditsHundredths: 0,
          maxCreditsHundredths: 1800,
        },
      },
    });
    const html = render({
      outcome: 'NO_FEASIBLE_PLAN',
      options: [],
      conflictSet: { items: [load], isMinimal: false, omittedCount: 0 },
    });
    expect(html).toContain(describeReason(ReasonCode.CreditLimitExceeded).explanation);
  });
});
