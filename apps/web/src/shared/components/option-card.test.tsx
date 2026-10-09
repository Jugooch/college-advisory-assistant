/**
 * @file Tests for the option cards and comparison: order, separate dimensions, meetings as text,
 * and the fixed wording for every scheduling reason code.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { ScheduleOptionsResponse } from '@caa/api-contract';
import { ReasonCode } from '@caa/domain';
import {
  buildCheckResult,
  buildScheduledSection,
  buildScheduleOption,
  buildScheduleOptionsResponse,
  buildSection,
  buildSectionBundle,
  buildTbaMeeting,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import { indexCourses } from '@/shared/utils/course-display';
import { describeReason } from '@/shared/utils/reason-code-wording';

import { ScheduleResults } from './schedule-results';

const { phys201, phys201Lab } = SYNTHETIC_COURSES;
const PHYS = 'DEMO-PHYS 201';
const LAB = 'DEMO-PHYS 201L';

const LECTURE = buildSection({ courseId: phys201.id }, 1);
const LAB_SECTION = buildSection({ courseId: phys201Lab.id, meetings: [buildTbaMeeting()] }, 2);
const BUNDLE = buildSectionBundle([LECTURE, buildScheduledSection(LAB_SECTION, false)], 400);

const COURSES = [
  {
    courseId: phys201.id,
    code: PHYS,
    title: null,
    credits: { kind: 'FIXED', creditsHundredths: 400 },
  },
  {
    courseId: phys201Lab.id,
    code: LAB,
    title: null,
    credits: { kind: 'FIXED', creditsHundredths: 0 },
  },
] as const;

/**
 * Builds one option over the lecture and lab, with fields overridden.
 *
 * @param overrides - Option fields to replace.
 * @returns The parsed option.
 */
function option(
  overrides: Parameters<typeof buildScheduleOption>[0] = {},
): ReturnType<typeof buildScheduleOption> {
  return buildScheduleOption({ bundles: [BUNDLE], ...overrides });
}

/**
 * Renders a response as the page would.
 *
 * @param overrides - Response fields to replace.
 * @returns The markup.
 */
function render(overrides: Partial<ScheduleOptionsResponse> = {}): string {
  const options = overrides.options ?? [option()];
  const result = buildScheduleOptionsResponse({
    courseIds: [phys201.id],
    courses: options.length === 0 ? COURSES.slice(0, 1) : COURSES,
    ...overrides,
    options,
  });
  return renderToStaticMarkup(<ScheduleResults result={result} courses={indexCourses([])} />);
}

const UNKNOWN_TIME = buildCheckResult({
  kind: 'SCHEDULE_FEASIBILITY',
  state: 'UNKNOWN',
  reasonCode: 'MEETING_TIME_UNKNOWN',
  evidence: {
    rulesetVersion: null,
    decisiveLeaves: [],
    scheduleIssues: [
      {
        reasonCode: 'MEETING_TIME_UNKNOWN',
        meeting: {
          sectionId: LECTURE.id,
          meetingIndex: 0,
          weekdays: null,
          startTime: null,
          endTime: null,
        },
        otherMeeting: null,
        sharedDates: null,
        constraintIndex: 0,
      },
    ],
  },
});

describe('ScheduleResults option card', () => {
  const html = render();

  it('puts the overall state before the sections, credits, and checks', () => {
    const order = [
      'Validated for the listed checks only',
      'Courses and sections',
      'Total credits: 4 credits',
      'Checks, shown separately',
    ].map((text) => html.indexOf(text));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('shows meetings as text, and a meeting to be announced as such', () => {
    expect(html).toContain('Monday, Wednesday, Friday, 9:00 AM to 9:50 AM');
    expect(html).toContain('days to be announced, time to be announced');
    expect(html).toContain('location to be announced');
    expect(html).toContain('linked section of');
  });

  it('shows each dimension separately, with no single approval', () => {
    for (const heading of [
      'Schedule feasibility',
      `Prerequisite for ${PHYS} (title not available)`,
      `Applicability of ${PHYS} (title not available)`,
      'Requirement allocation',
      'Credit load',
    ]) {
      expect(html).toContain(`<h4>${heading}</h4>`);
    }
  });

  it('keeps UNKNOWN and linked-course checks as returned, never validated', () => {
    const unknown = UNKNOWN_TIME;
    const linked = buildCheckResult({
      kind: 'REQUIREMENT_APPLICABILITY',
      state: 'UNKNOWN',
      reasonCode: 'LINKED_COURSE_NOT_CHECKED',
    });
    const out = render({
      options: [
        option({
          scheduleFeasibility: unknown,
          aggregate: 'NEEDS_VERIFICATION',
          linkedCourseResults: [
            {
              courseId: phys201Lab.id,
              prerequisite: { ...linked, kind: 'PREREQUISITE' },
              applicability: linked,
            },
          ],
        }),
      ],
    });
    expect(out).toContain('Needs verification');
    expect(out).not.toContain('Validated for the listed checks only');
    expect(out).toContain(`Prerequisite for ${LAB} (title not available) (linked section)`);
    expect(out).toContain(describeReason(ReasonCode.LinkedCourseNotChecked).explanation);
  });

  it('lists unmet preferences, and says unknown data is not a miss it can rule out', () => {
    const out = render({
      options: [
        option({
          unmetPreferences: [
            {
              constraintIndex: 0,
              priorityRank: 1,
              kind: 'ALLOWED_MODALITIES',
              sectionId: LECTURE.id,
              meetingIndex: null,
              isDataUnknown: false,
            },
            {
              constraintIndex: 1,
              priorityRank: 2,
              kind: 'UNAVAILABLE_TIME',
              sectionId: LAB_SECTION.id,
              meetingIndex: 0,
              isDataUnknown: true,
            },
          ],
        }),
      ],
    });
    expect(out).toContain('Preference ranked 1');
    expect(out).toContain('still to be announced');
  });
});

describe('ScheduleResults comparison', () => {
  it('compares options in a scrollable table with consistent headers', () => {
    const second = buildScheduleOption({
      rank: 2,
      bundles: [buildSectionBundle([buildSection({ courseId: phys201.id }, 5)], 400)],
    });
    const html = render({ options: [option(), second] });
    const headers = [...html.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map((m) => m[1]);
    expect(headers).toEqual([
      'Option',
      'Overall state',
      'Schedule feasibility',
      'Credit load',
      'Total credits',
      'Missed preferences',
    ]);
    const targets = [...html.matchAll(/<a href="#([^"]+)">Option \d+<\/a>/g)].map((m) => m[1]);
    expect(targets).toHaveLength(2);
    for (const target of targets) {
      expect(html).toMatch(new RegExp(`<h3 id="${String(target)}">Option \\d+</h3>`));
    }
    expect(html).toContain('data-label="Missed preferences"');
  });
});
