/**
 * @file Builds synthetic unmet preferences: which preference a schedule option misses, and where.
 * @module @caa/test-kit/builders/unmet-preference
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import {
  createUnmetPreference,
  ScheduleConstraintKind,
  type UnmetPreference,
  type UnmetPreferenceInput,
} from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';

/**
 * Builds a valid unmet preference: the rank-1 `UNAVAILABLE_TIME` preference at constraint index
 * 0 (as `buildUnavailableTime()` states it), missed by meeting 0 of section seed 1 on known
 * data.
 *
 * @param overrides - Fields to replace in the default. A `CREDIT_RANGE` miss names no section or
 *   meeting, and an `ALLOWED_MODALITIES` miss names a section but no meeting.
 * @returns A validated unmet preference.
 */
export function buildUnmetPreference(
  overrides: Partial<UnmetPreferenceInput> = {},
): UnmetPreference {
  return createUnmetPreference({
    constraintIndex: 0,
    priorityRank: 1,
    kind: ScheduleConstraintKind.UnavailableTime,
    sectionId: syntheticId('section', 1),
    meetingIndex: 0,
    isDataUnknown: false,
    ...overrides,
  });
}
