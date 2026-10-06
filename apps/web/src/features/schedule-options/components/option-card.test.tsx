/**
 * @file Tests for the option cards and comparison: order, separate dimensions, meetings as text,
 * and the fixed wording for every scheduling reason code.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { ScheduleOptionsResponse } from '@caa/api-contract';
import { ReasonCode } from '@caa/domain';

import { describeReason } from '@/shared/utils/reason-code-wording';

import {
  BANNED,
  buildOption,
  buildResult,
  COURSES,
  LAB,
  LAB_SECTION_ID,
  SECTION_ID,
} from '../utils/schedule-result-fixtures';
import { ScheduleResults } from './schedule-results';

function render(result: ScheduleOptionsResponse): string {
  return renderToStaticMarkup(<ScheduleResults result={result} courses={COURSES} />);
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

describe('ScheduleResults option card', () => {
  const html = render(buildResult());

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
    expect(html).toContain('Monday, Wednesday, 9:00 AM to 9:50 AM');
    expect(html).toContain('days to be announced, time to be announced');
    expect(html).toContain('location to be announced');
    expect(html).toContain('linked section of');
  });

  it('shows each dimension separately, with no single approval', () => {
    for (const heading of [
      'Schedule feasibility',
      'Prerequisite for PHYS 301 (Mechanics)',
      'Applicability of PHYS 301 (Mechanics)',
      'Requirement allocation',
      'Credit load',
    ]) {
      expect(html).toContain(`<h4>${heading}</h4>`);
    }
  });

  it('keeps UNKNOWN, FAIL-free and linked-course checks as returned', () => {
    const option = buildOption({
      scheduleFeasibility: {
        kind: 'SCHEDULE_FEASIBILITY',
        state: 'UNKNOWN',
        reasonCode: 'MEETING_TIME_UNKNOWN',
      },
      aggregate: 'NEEDS_VERIFICATION',
      linkedCourseResults: [
        {
          courseId: LAB,
          prerequisite: {
            kind: 'PREREQUISITE',
            state: 'UNKNOWN',
            reasonCode: 'LINKED_COURSE_NOT_CHECKED',
          },
          applicability: {
            kind: 'REQUIREMENT_APPLICABILITY',
            state: 'UNKNOWN',
            reasonCode: 'LINKED_COURSE_NOT_CHECKED',
          },
        },
      ],
    });
    const out = render(buildResult({ options: [option] }));
    expect(out).toContain('Needs verification');
    expect(out).not.toContain('Validated for the listed checks only');
    expect(out).toContain('Prerequisite for PHYS 301L (Mechanics Lab) (linked section)');
    expect(out).toContain(describeReason(ReasonCode.LinkedCourseNotChecked).explanation);
  });

  it('lists unmet preferences, and says unknown data is not a miss it can rule out', () => {
    const option = buildOption({
      unmetPreferences: [
        {
          constraintIndex: 0,
          priorityRank: 1,
          kind: 'ALLOWED_MODALITIES',
          sectionId: SECTION_ID,
          meetingIndex: null,
          isDataUnknown: false,
        },
        {
          constraintIndex: 1,
          priorityRank: 2,
          kind: 'UNAVAILABLE_TIME',
          sectionId: LAB_SECTION_ID,
          meetingIndex: 0,
          isDataUnknown: true,
        },
      ],
    });
    const out = render(buildResult({ options: [option] }));
    expect(out).toContain('Preference ranked 1');
    expect(out).toContain('still to be announced');
  });
});

describe('ScheduleResults comparison and reason codes', () => {
  it('compares options in a table with consistent headers', () => {
    const second = buildOption({ rank: 2 });
    const html = render(buildResult({ options: [buildOption(), second] }));
    const headers = [...html.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map((m) => m[1]);
    expect(headers).toEqual([
      'Option',
      'Overall state',
      'Schedule feasibility',
      'Credit load',
      'Total credits',
      'Missed preferences',
    ]);
    expect(html).toContain('href="#option-2-heading"');
  });

  const SCHEDULING_CODES = [
    ReasonCode.MeetingConflict,
    ReasonCode.TransitionTimeInsufficient,
    ReasonCode.TransitionTimeUndefined,
    ReasonCode.MeetingTimeUnknown,
    ReasonCode.MeetingLocationUnknown,
    ReasonCode.UnavailableTimeConflict,
    ReasonCode.ModalityNotAllowed,
    ReasonCode.CampusNotAllowed,
    ReasonCode.LinkedSectionUnavailable,
    ReasonCode.LinkedCourseNotChecked,
    ReasonCode.SectionDataMissing,
    ReasonCode.VariableCreditUnselected,
    ReasonCode.CreditBoundsUndefined,
    ReasonCode.CreditLimitExceeded,
    ReasonCode.CreditBelowMinimum,
  ];

  it.each(SCHEDULING_CODES)('renders %s from the fixed wording only', (code) => {
    const option = buildOption({
      scheduleFeasibility: { kind: 'SCHEDULE_FEASIBILITY', state: 'UNKNOWN', reasonCode: code },
      aggregate: 'NEEDS_VERIFICATION',
    });
    const html = render(buildResult({ options: [option] }));
    const wording = describeReason(code);
    expect(html).toContain(wording.explanation);
    expect(html).toContain(wording.nextStep);
    expect(words(html)).not.toMatch(BANNED);
  });
});
