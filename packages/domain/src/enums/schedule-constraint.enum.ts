/**
 * @file Strength and kind of a student's schedule constraint.
 * @module @caa/domain/enums/schedule-constraint
 * @requirement FR-08
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { z } from 'zod';

/**
 * How strictly the solver applies a constraint (FR-08 keeps the two apart):
 * - `HARD`: every option must satisfy it, and the solver never relaxes it. An option where it
 *   can't be decided (for example a meeting time to be announced) is UNKNOWN, never PASS.
 * - `PREFERRED`: an option may miss it. Misses are ranked by the student's priority order and
 *   reported as unmet preferences (ADR-0010 §4).
 */
export const ConstraintStrength = {
  Hard: 'HARD',
  Preferred: 'PREFERRED',
} as const;

/** Union of every {@link ConstraintStrength} value. */
export type ConstraintStrength = (typeof ConstraintStrength)[keyof typeof ConstraintStrength];

/** Runtime schema for {@link ConstraintStrength}. */
export const ConstraintStrengthSchema = z.enum(ConstraintStrength);

/**
 * What a schedule constraint restricts:
 * - `UNAVAILABLE_TIME`: weekday time blocks the student can't attend, such as "no Fridays".
 * - `CREDIT_RANGE`: the student's own credit-load range, inside the policy's term bounds.
 * - `ALLOWED_MODALITIES`: the section delivery modes the student accepts.
 * - `ALLOWED_CAMPUSES`: the campuses the student can attend meetings on.
 */
export const ScheduleConstraintKind = {
  UnavailableTime: 'UNAVAILABLE_TIME',
  CreditRange: 'CREDIT_RANGE',
  AllowedModalities: 'ALLOWED_MODALITIES',
  AllowedCampuses: 'ALLOWED_CAMPUSES',
} as const;

/** Union of every {@link ScheduleConstraintKind} value. */
export type ScheduleConstraintKind =
  (typeof ScheduleConstraintKind)[keyof typeof ScheduleConstraintKind];

/** Runtime schema for {@link ScheduleConstraintKind}. */
export const ScheduleConstraintKindSchema = z.enum(ScheduleConstraintKind);
