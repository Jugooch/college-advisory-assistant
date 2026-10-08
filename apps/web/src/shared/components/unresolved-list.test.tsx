/**
 * @file Tests for the unresolved list: campus names come from the lookup, by ID.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  buildCheckResult,
  buildSection,
  SYNTHETIC_CAMPUSES,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import { indexCampuses } from '@/shared/utils/campus-display';
import { indexCourses } from '@/shared/utils/course-display';

import { UnresolvedList } from './unresolved-list';

const { north, south } = SYNTHETIC_CAMPUSES;
const SECTION = buildSection({ courseId: SYNTHETIC_COURSES.phys201.id }, 1);

const REF = (meetingIndex: number, startTime: string, endTime: string) => ({
  sectionId: SECTION.id,
  meetingIndex,
  weekdays: ['MONDAY'] as const,
  startTime,
  endTime,
});

const UNDEFINED_TRANSITION = buildCheckResult({
  kind: 'SCHEDULE_FEASIBILITY',
  state: 'UNKNOWN',
  reasonCode: 'TRANSITION_TIME_UNDEFINED',
  evidence: {
    rulesetVersion: null,
    decisiveLeaves: [],
    scheduleIssues: [
      {
        reasonCode: 'TRANSITION_TIME_UNDEFINED',
        earlier: REF(0, '09:00', '09:50'),
        later: REF(1, '10:00', '10:50'),
        sharedDates: { firstDate: '2026-08-24', lastDate: '2026-12-11', weekdays: ['MONDAY'] },
        fromCampusId: north.id,
        toCampusId: south.id,
        availableMinutes: 10,
        requiredMinutes: null,
      },
    ] as never,
  },
});

/**
 * Renders the list with the given campus names.
 *
 * @param names - Campus entries.
 * @returns The markup.
 */
function render(names: readonly { id: string; name: string }[]): string {
  return renderToStaticMarkup(
    <UnresolvedList
      unresolved={[UNDEFINED_TRANSITION]}
      asOf="as of the pinned inputs"
      courses={indexCourses([])}
      campuses={indexCampuses(names as never)}
    />,
  );
}

describe('UnresolvedList campus names', () => {
  it('names both campuses of an unresolved transition, never by ID', () => {
    const html = render([north, south]);
    expect(html).toContain(`Between campus ${north.name} and campus ${south.name}`);
    expect(html).not.toContain(north.id);
  });

  it('shows the ID with a note when a campus has no name', () => {
    const html = render([north]);
    expect(html).toContain(`${south.id} (name unavailable)`);
  });
});
