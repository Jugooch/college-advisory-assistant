/**
 * @file Schedule constraints: what a student asks of a schedule, as hard rules or preferences.
 * @module @caa/domain/models/schedule-constraint
 * @requirement FR-07
 * @requirement FR-08
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { z } from 'zod';

import {
  ConstraintStrength,
  ConstraintStrengthSchema,
  ScheduleConstraintKind,
} from '../enums/schedule-constraint.enum';
import { SectionModalitySchema } from '../enums/section-modality.enum';
import { WeekdaySchema } from '../enums/weekday.enum';
import { CampusIdSchema } from './campus.model';
import { LocalTimeSchema } from './meeting-pattern.model';

/** Most constraints one request may carry, which bounds the solver's pre-search work. */
export const MAX_SCHEDULE_CONSTRAINTS = 32;

/**
 * Returns whether no value appears twice.
 *
 * @param values - Values to check.
 * @returns `false` when any value repeats.
 */
function isDistinct(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

/** Schema for a credit amount in hundredths of a credit (1200 = 12.00 credits). Never a float. */
const CreditsHundredthsSchema = z.number().int().nonnegative();

/**
 * Fields every constraint has. A `HARD` item has `priorityRank: null`; a `PREFERRED` item has
 * the student's rank, 1 first, so the ordering the solver used can be inspected (planning/08
 * §Constraint formulation).
 */
const STRENGTH_FIELDS = {
  strength: ConstraintStrengthSchema,
  /** The student's priority for a preference, 1 first, or `null` for a hard constraint. */
  priorityRank: z.number().int().positive().nullable(),
};

/**
 * Schema for weekday time blocks the student can't attend, such as "no Fridays" (Friday
 * `00:00`–`24:00`) or "not before 10:00" (each weekday `00:00`–`10:00`).
 *
 * Times are local wall-clock times in the section snapshot's time zone. The block is half-open,
 * `[startTime, endTime)`, like a meeting, so a meeting that ends exactly at `startTime` or
 * starts exactly at `endTime` doesn't conflict with it. `endTime` may be `24:00`, the end of
 * the day. A meeting whose time is to be announced never satisfies a hard block (planning/08
 * §Schedule model).
 */
const UnavailableTimeSchema = z
  .object({
    kind: z.literal(ScheduleConstraintKind.UnavailableTime),
    ...STRENGTH_FIELDS,
    /** Days the block applies to. At least one, none repeated. */
    weekdays: z.array(WeekdaySchema).min(1).readonly(),
    /** Local start of the block, inclusive. */
    startTime: LocalTimeSchema,
    /** Local end of the block, exclusive. `24:00` means the end of the day. */
    endTime: z.union([LocalTimeSchema, z.literal('24:00')]),
  })
  .refine((block) => isDistinct(block.weekdays), {
    message: 'weekdays must not repeat a day',
    path: ['weekdays'],
  })
  // SAFETY: a block that ends before it starts covers no time, so a hard constraint the student
  // stated would silently exclude nothing.
  // NOTE: `HH:MM` strings, and `24:00`, sort in time order, so a string comparison is exact.
  .refine((block) => block.startTime < block.endTime, {
    message: 'startTime must be earlier than endTime',
    path: ['endTime'],
  })
  .readonly();

/**
 * Schema for the student's own credit-load range, in hundredths of a credit. A `null` bound
 * means the student sets none on that side, so only the policy's term bound applies there. The
 * range applies inside the policy's term bounds and never widens them; the service compares it
 * with the policy, because the policy isn't part of the request.
 */
const CreditRangeSchema = z
  .object({
    kind: z.literal(ScheduleConstraintKind.CreditRange),
    ...STRENGTH_FIELDS,
    /** Lowest total the student accepts, or `null` for no student minimum. */
    minCreditsHundredths: CreditsHundredthsSchema.nullable(),
    /** Highest total the student accepts, or `null` for no student maximum. */
    maxCreditsHundredths: CreditsHundredthsSchema.nullable(),
  })
  .refine((range) => range.minCreditsHundredths !== null || range.maxCreditsHundredths !== null, {
    message: 'A credit range needs a minimum, a maximum, or both',
    path: ['minCreditsHundredths'],
  })
  // SAFETY: a minimum above the maximum admits no load, so the request contradicts itself and is
  // rejected rather than adjusted.
  .refine(
    (range) =>
      range.minCreditsHundredths === null ||
      range.maxCreditsHundredths === null ||
      range.minCreditsHundredths <= range.maxCreditsHundredths,
    {
      message: 'minCreditsHundredths must not exceed maxCreditsHundredths',
      path: ['minCreditsHundredths'],
    },
  )
  .readonly();

/** Schema for the section delivery modes the student accepts. */
const AllowedModalitiesSchema = z
  .object({
    kind: z.literal(ScheduleConstraintKind.AllowedModalities),
    ...STRENGTH_FIELDS,
    /** Accepted modalities. At least one, none repeated. */
    modalities: z.array(SectionModalitySchema).min(1).readonly(),
  })
  .refine((allowed) => isDistinct(allowed.modalities), {
    message: 'modalities must not repeat a modality',
    path: ['modalities'],
  })
  .readonly();

/**
 * Schema for the campuses the student can attend meetings on. It applies to each on-campus
 * meeting's location. An online meeting isn't subject to it, and a meeting whose location is to
 * be announced never satisfies a hard campus constraint.
 */
const AllowedCampusesSchema = z
  .object({
    kind: z.literal(ScheduleConstraintKind.AllowedCampuses),
    ...STRENGTH_FIELDS,
    /** Accepted campuses. At least one, none repeated. */
    campusIds: z.array(CampusIdSchema).min(1).readonly(),
  })
  .refine((allowed) => isDistinct(allowed.campusIds), {
    message: 'campusIds must not repeat a campus',
    path: ['campusIds'],
  })
  .readonly();

/** Schema for one schedule constraint of any kind. */
export const ScheduleConstraintSchema = z
  .discriminatedUnion('kind', [
    UnavailableTimeSchema,
    CreditRangeSchema,
    AllowedModalitiesSchema,
    AllowedCampusesSchema,
  ])
  // SAFETY: a rank on a hard constraint would suggest the solver may trade it off, and a
  // preference without one leaves the ranking order unstated.
  .refine(
    (constraint) =>
      (constraint.strength === ConstraintStrength.Hard) === (constraint.priorityRank === null),
    {
      message: 'A HARD constraint has no priorityRank, and a PREFERRED one has one',
      path: ['priorityRank'],
    },
  );

/** A validated, immutable schedule constraint. */
export type ScheduleConstraint = z.infer<typeof ScheduleConstraintSchema>;

/** Raw input accepted by {@link createScheduleConstraint}. */
export type ScheduleConstraintInput = z.input<typeof ScheduleConstraintSchema>;

/**
 * Creates a validated, immutable schedule constraint.
 *
 * @param input - Raw constraint fields.
 * @returns The parsed schedule constraint.
 * @throws {z.ZodError} When a field is invalid, a list repeats a value, a time block or credit
 *   range is inverted, a credit range has no bound, or the rank contradicts the strength.
 */
export function createScheduleConstraint(input: ScheduleConstraintInput): ScheduleConstraint {
  return ScheduleConstraintSchema.parse(input);
}

/** Kinds a request may state at most once per strength, because two would have to intersect. */
const SINGLE_PER_STRENGTH_KINDS: readonly ScheduleConstraintKind[] = [
  ScheduleConstraintKind.CreditRange,
  ScheduleConstraintKind.AllowedModalities,
  ScheduleConstraintKind.AllowedCampuses,
];

/**
 * Schema for the constraints of one request, in the order the student stated them. Other
 * objects refer to an item by its index in this list. An empty list means the student asked
 * for nothing beyond the academic rules.
 *
 * A self-contradictory set is rejected with a validation error and never adjusted silently.
 */
export const ScheduleConstraintSetSchema = z
  .array(ScheduleConstraintSchema)
  .max(MAX_SCHEDULE_CONSTRAINTS)
  .readonly()
  // SAFETY: two preferences with one rank leave the ranking order undefined, so the options the
  // student sees could depend on list order rather than on what they asked for.
  .refine(
    (constraints) =>
      isDistinct(
        constraints.flatMap((constraint) =>
          constraint.priorityRank === null ? [] : [String(constraint.priorityRank)],
        ),
      ),
    { message: 'Each preference must have a different priorityRank' },
  )
  // SAFETY: two hard credit ranges, modality lists, or campus lists would have to be
  // intersected, and an empty intersection would silently exclude every schedule.
  .refine(
    (constraints) =>
      isDistinct(
        constraints
          .filter((constraint) => SINGLE_PER_STRENGTH_KINDS.includes(constraint.kind))
          .map((constraint) => `${constraint.kind}:${constraint.strength}`),
      ),
    {
      message:
        'State at most one CREDIT_RANGE, ALLOWED_MODALITIES, and ALLOWED_CAMPUSES per strength',
    },
  );

/** A validated, immutable schedule constraint set. */
export type ScheduleConstraintSet = z.infer<typeof ScheduleConstraintSetSchema>;

/** Raw input accepted by {@link createScheduleConstraintSet}. */
export type ScheduleConstraintSetInput = z.input<typeof ScheduleConstraintSetSchema>;

/**
 * Creates a validated, immutable schedule constraint set.
 *
 * @param input - The request's constraints, in the order the student stated them.
 * @returns The parsed schedule constraint set.
 * @throws {z.ZodError} When a constraint is invalid, there are more than
 *   {@link MAX_SCHEDULE_CONSTRAINTS}, two preferences share a rank, or a single-per-strength
 *   kind appears twice with one strength.
 */
export function createScheduleConstraintSet(
  input: ScheduleConstraintSetInput,
): ScheduleConstraintSet {
  return ScheduleConstraintSetSchema.parse(input);
}
