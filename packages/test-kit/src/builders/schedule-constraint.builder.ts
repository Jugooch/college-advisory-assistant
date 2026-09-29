/**
 * @file Builds synthetic schedule constraints and constraint sets: hard rules and preferences.
 * @module @caa/test-kit/builders/schedule-constraint
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import {
  ConstraintStrength,
  createScheduleConstraint,
  createScheduleConstraintSet,
  type ScheduleConstraint,
  type ScheduleConstraintInput,
  ScheduleConstraintKind,
  type ScheduleConstraintSet,
  type ScheduleConstraintSetInput,
  SectionModality,
  Weekday,
} from '@caa/domain';

import { SYNTHETIC_CAMPUSES } from '../fixtures/synthetic-campuses';

/** Raw fields of one constraint kind, without its `kind`. */
type KindFields<K extends ScheduleConstraintKind> = Omit<
  Extract<ScheduleConstraintInput, { kind: K }>,
  'kind'
>;

/**
 * Spread into a builder's overrides to make the constraint hard, for example
 * `buildUnavailableTime({ ...HARD_STRENGTH })`. Builders default to a preference, so a test gets
 * a hard constraint only when it asks for one.
 */
export const HARD_STRENGTH = { strength: ConstraintStrength.Hard, priorityRank: null } as const;

/** The strength every constraint builder defaults to: a preference with priority rank 1. */
const PREFERRED_RANK_1 = { strength: ConstraintStrength.Preferred, priorityRank: 1 } as const;

/**
 * Builds a valid unavailable-time constraint: "no Fridays" (Friday `00:00`–`24:00`), preferred
 * at rank 1.
 *
 * @param overrides - Fields to replace in the default. Spread {@link HARD_STRENGTH} for a hard
 *   constraint.
 * @returns A validated schedule constraint of kind `UNAVAILABLE_TIME`.
 */
export function buildUnavailableTime(
  overrides: Partial<KindFields<'UNAVAILABLE_TIME'>> = {},
): ScheduleConstraint {
  return createScheduleConstraint({
    kind: ScheduleConstraintKind.UnavailableTime,
    ...PREFERRED_RANK_1,
    weekdays: [Weekday.Friday],
    startTime: '00:00',
    endTime: '24:00',
    ...overrides,
  });
}

/**
 * Builds a valid credit-range constraint: 12.00 to 15.00 credits, preferred at rank 1.
 *
 * @param overrides - Fields to replace in the default. Spread {@link HARD_STRENGTH} for a hard
 *   constraint.
 * @returns A validated schedule constraint of kind `CREDIT_RANGE`.
 */
export function buildCreditRange(
  overrides: Partial<KindFields<'CREDIT_RANGE'>> = {},
): ScheduleConstraint {
  return createScheduleConstraint({
    kind: ScheduleConstraintKind.CreditRange,
    ...PREFERRED_RANK_1,
    minCreditsHundredths: 1200,
    maxCreditsHundredths: 1500,
    ...overrides,
  });
}

/**
 * Builds a valid allowed-modalities constraint: in person only, preferred at rank 1.
 *
 * @param overrides - Fields to replace in the default. Spread {@link HARD_STRENGTH} for a hard
 *   constraint.
 * @returns A validated schedule constraint of kind `ALLOWED_MODALITIES`.
 */
export function buildAllowedModalities(
  overrides: Partial<KindFields<'ALLOWED_MODALITIES'>> = {},
): ScheduleConstraint {
  return createScheduleConstraint({
    kind: ScheduleConstraintKind.AllowedModalities,
    ...PREFERRED_RANK_1,
    modalities: [SectionModality.InPerson],
    ...overrides,
  });
}

/**
 * Builds a valid allowed-campuses constraint: `SYNTHETIC_CAMPUSES.north` only, preferred at
 * rank 1.
 *
 * @param overrides - Fields to replace in the default. Spread {@link HARD_STRENGTH} for a hard
 *   constraint.
 * @returns A validated schedule constraint of kind `ALLOWED_CAMPUSES`.
 */
export function buildAllowedCampuses(
  overrides: Partial<KindFields<'ALLOWED_CAMPUSES'>> = {},
): ScheduleConstraint {
  return createScheduleConstraint({
    kind: ScheduleConstraintKind.AllowedCampuses,
    ...PREFERRED_RANK_1,
    campusIds: [SYNTHETIC_CAMPUSES.north.id],
    ...overrides,
  });
}

/**
 * Builds a validated constraint set, in the order given. The default is empty: the student asks
 * for nothing beyond the academic rules. Each preference in a set needs its own rank.
 *
 * @param constraints - The constraints, in the order the student stated them.
 * @returns A validated schedule constraint set.
 * @throws {z.ZodError} When two preferences share a rank, or a single-per-strength kind repeats.
 */
export function buildScheduleConstraintSet(
  constraints: ScheduleConstraintSetInput = [],
): ScheduleConstraintSet {
  return createScheduleConstraintSet(constraints);
}
