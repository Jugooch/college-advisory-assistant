/**
 * @file Tests for listing candidate courses once each.
 */
import { describe, expect, it } from 'vitest';

import { buildRequirementResult, SYNTHETIC_COURSES } from '@caa/test-kit';

import { listCandidateCourses } from './candidate-courses';

describe('listCandidateCourses', () => {
  it('lists each course once with every requirement that names it', () => {
    const { math101, math102 } = SYNTHETIC_COURSES;
    const core = buildRequirementResult(
      { label: 'Core', candidateCourseIds: [math101.id, math102.id] },
      1,
    );
    const elective = buildRequirementResult(
      { label: 'Elective', candidateCourseIds: [math102.id] },
      2,
    );

    expect(listCandidateCourses([core, elective])).toEqual([
      { courseId: math101.id, requirementLabels: ['Core'] },
      { courseId: math102.id, requirementLabels: ['Core', 'Elective'] },
    ]);
  });
});
