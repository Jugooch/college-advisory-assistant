/**
 * @file Tests for the term label and campus names on the schedule results: names come from the
 * response's `term` and `campuses`, looked up by ID, and a missing name is said so.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { ScheduleOptionsResponse } from '@caa/api-contract';
import {
  buildCheckResult,
  buildOnlineAsynchronousSection,
  buildScheduledSection,
  buildScheduleOption,
  buildScheduleOptionsResponse,
  buildSection,
  buildSectionBundle,
  SYNTHETIC_CAMPUSES,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import { indexCourses } from '@/shared/utils/course-display';

import { ScheduleResults } from './schedule-results';

const { phys201 } = SYNTHETIC_COURSES;
const NORTH = SYNTHETIC_CAMPUSES.north;
const SOUTH = SYNTHETIC_CAMPUSES.south;

const ON_CAMPUS = buildSection({ courseId: phys201.id }, 1);
const ONLINE = buildOnlineAsynchronousSection({ courseId: phys201.id }, 2);

const TRANSITION_CHECK = buildCheckResult({
  kind: 'SCHEDULE_FEASIBILITY',
  state: 'FAIL',
  reasonCode: 'TRANSITION_TIME_INSUFFICIENT',
  evidence: {
    rulesetVersion: null,
    decisiveLeaves: [],
    scheduleIssues: [
      {
        reasonCode: 'TRANSITION_TIME_INSUFFICIENT',
        earlier: {
          sectionId: ON_CAMPUS.id,
          meetingIndex: 0,
          weekdays: ['MONDAY'],
          startTime: '09:00',
          endTime: '09:50',
        },
        later: {
          sectionId: ON_CAMPUS.id,
          meetingIndex: 1,
          weekdays: ['MONDAY'],
          startTime: '10:00',
          endTime: '10:50',
        },
        sharedDates: { firstDate: '2026-08-24', lastDate: '2026-12-11', weekdays: ['MONDAY'] },
        fromCampusId: NORTH.id,
        toCampusId: SOUTH.id,
        availableMinutes: 10,
        requiredMinutes: 20,
      },
    ] as never,
  },
});

/**
 * Renders a response as the page would.
 *
 * @param overrides - Response fields to replace.
 * @param missingNames - Drop the response's campus names after it is built.
 * @returns The markup.
 */
function render(overrides: Partial<ScheduleOptionsResponse> = {}, missingNames = false): string {
  const built = buildScheduleOptionsResponse(overrides);
  // The contract forbids a missing name, so this one case is built after parsing.
  const result = missingNames ? { ...built, campuses: [] } : built;
  return renderToStaticMarkup(<ScheduleResults result={result} courses={indexCourses([])} />);
}

/**
 * Builds one option over the given sections.
 *
 * @param sections - The sections of the one bundle.
 * @returns The option.
 */
function optionOver(
  sections: readonly (typeof ON_CAMPUS)[],
): ReturnType<typeof buildScheduleOption> {
  return buildScheduleOption({
    bundles: [
      buildSectionBundle(
        sections.map((s) => buildScheduledSection(s)),
        300,
      ),
    ],
  });
}

describe('ScheduleResults term and campus names', () => {
  it('shows the term code and dates from the response', () => {
    const html = render();
    expect(html).toContain('Term: 2027SP');
    expect(html).toContain('Jan 11, 2027 to May 7, 2027');
  });

  it('shows the campus name, never the ID, for an on-campus section', () => {
    const html = render({ options: [optionOver([ON_CAMPUS])] });
    expect(html).toContain(`Campus: ${NORTH.name}`);
    expect(html).not.toContain(NORTH.id);
  });

  it('shows both campus names for a transition issue', () => {
    const html = render({
      courseIds: [phys201.id],
      outcome: 'NO_FEASIBLE_PLAN',
      options: [],
      conflictSet: { items: [TRANSITION_CHECK], isMinimal: false, omittedCount: 0 },
    });
    expect(html).toContain(`Between campus ${NORTH.name} and campus ${SOUTH.name}`);
    expect(html).not.toContain(SOUTH.id);
  });

  it('shows no campus line for an online section with no campus', () => {
    const html = render({ options: [optionOver([ONLINE])] });
    expect(html).not.toContain('Campus:');
  });

  it('shows the ID with a visible note when the response has no name for it', () => {
    const html = render({ options: [optionOver([ON_CAMPUS])] }, true);
    expect(html).toContain(`Campus: ${NORTH.id} (name unavailable)`);
  });
});
