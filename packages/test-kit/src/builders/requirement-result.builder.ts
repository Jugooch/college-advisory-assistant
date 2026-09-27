/**
 * @file Builds synthetic degree-audit requirement results for tests.
 * @module @caa/test-kit/builders/requirement-result
 */
import {
  createRequirementResult,
  type RequirementResult,
  type RequirementResultInput,
  RequirementState,
} from '@caa/domain';

import { SYNTHETIC_COURSES } from '../fixtures/synthetic-courses';

/**
 * Builds a valid top-level requirement, `Mathematics core`, that is `INCOMPLETE` with one
 * course (3.00 credits) remaining, DEMO-MATH 102 as its only candidate, no allocated attempts,
 * and no reuse.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes requirements; drives the default `sourceRequirementId`, for example
 *   `REQ-001`, and the matching `sourceRef`, `demo-audit/REQ-001`.
 * @returns A validated requirement result.
 */
export function buildRequirementResult(
  overrides: Partial<RequirementResultInput> = {},
  seed = 1,
): RequirementResult {
  const sourceRequirementId = `REQ-${String(seed).padStart(3, '0')}`;
  return createRequirementResult({
    sourceRequirementId,
    parentSourceRequirementId: null,
    label: 'Mathematics core',
    state: RequirementState.Incomplete,
    allocatedAttemptIds: [],
    remainingCreditsHundredths: 300,
    remainingCourseCount: 1,
    candidateCourseIds: [SYNTHETIC_COURSES.math102.id],
    isReusable: false,
    sourceRef: `demo-audit/${sourceRequirementId}`,
    ...overrides,
  });
}
