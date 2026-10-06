/**
 * @file Lists the courses the audit names as candidates, once each, with the requirements that
 * list them.
 * @module @caa/web/shared/utils/candidate-courses
 * @requirement FR-04
 */
import type { AcademicSummaryResponse } from '@caa/api-contract';

/** One candidate course and the labels of the requirements that list it, in audit order. */
export interface CandidateCourse {
  readonly courseId: string;
  readonly requirementLabels: readonly string[];
}

/**
 * Groups the audit's candidate courses for the picker. Grouping only; the audit decides which
 * courses are candidates, and the API decides whether they apply.
 *
 * @param requirements - The summary's requirements.
 * @returns Each candidate course once, in first-listed order.
 */
export function listCandidateCourses(
  requirements: AcademicSummaryResponse['requirements'],
): readonly CandidateCourse[] {
  const labelsByCourse = new Map<string, string[]>();
  for (const requirement of requirements) {
    for (const courseId of requirement.candidateCourseIds) {
      const labels = labelsByCourse.get(courseId) ?? [];
      labels.push(requirement.label);
      labelsByCourse.set(courseId, labels);
    }
  }
  return [...labelsByCourse].map(([courseId, requirementLabels]) => ({
    courseId,
    requirementLabels,
  }));
}
