/**
 * @file Term data object: one academic term of a tenant, and the tenant's ordered term calendar.
 * @module @caa/domain/models/term
 * @requirement FR-06
 * @requirement FR-09
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

import { InstitutionIdSchema } from './institution.model';

/** Branded ID so a term ID can never be passed where another ID is expected. */
export const TermIdSchema = z.uuid().brand<'TermId'>();

/** Unique identifier of a {@link Term}. */
export type TermId = z.infer<typeof TermIdSchema>;

/**
 * Schema for a term. Term IDs and codes are tenant-specific (planning/09).
 *
 * Terms are ordered by `sequence`, never by comparing `termCode` strings: `2026SP` sorts before
 * `2026SU` and `2026FA` sorts before both, whatever the calendar says. Within one tenant,
 * `termCode` is unique and so is `sequence`. A single term can't check that; the
 * {@link TermCalendarSchema} does for a tenant's term list, and persistence enforces it with
 * unique keys on (`tenantId`, `termCode`) and (`tenantId`, `sequence`).
 */
export const TermSchema = z
  .object({
    id: TermIdSchema,
    tenantId: InstitutionIdSchema,
    /** Term code in the source system, for example `2026FA`. Matches `CourseAttempt.termCode`. */
    termCode: z.string().min(1),
    /** First day of the term, `YYYY-MM-DD` in the institution's calendar. */
    startsOn: z.iso.date(),
    /** Last day of the term, `YYYY-MM-DD` in the institution's calendar. Inclusive. */
    endsOn: z.iso.date(),
    /** Position in the tenant's term order; a later term has a larger value. Gaps are allowed. */
    sequence: z.number().int(),
  })
  // SAFETY: a term that ends before it starts has no valid dates, so any date-based check on
  // it would be meaningless.
  // NOTE: `YYYY-MM-DD` strings sort in date order, so a string comparison is exact here.
  .refine((term) => term.startsOn <= term.endsOn, {
    message: 'startsOn must not be later than endsOn',
    path: ['endsOn'],
  })
  .readonly();

/** A validated, immutable term. */
export type Term = z.infer<typeof TermSchema>;

/** Raw input accepted by {@link createTerm}. */
export type TermInput = z.input<typeof TermSchema>;

/**
 * Creates a validated, immutable term.
 *
 * @param input - Raw term fields.
 * @returns The parsed term.
 * @throws {z.ZodError} When a field is invalid or `startsOn` is after `endsOn`.
 */
export function createTerm(input: TermInput): Term {
  return TermSchema.parse(input);
}

/**
 * Returns whether each value is larger than the one before it.
 *
 * @param values - Values in list order.
 * @returns `false` when any value is equal to or smaller than its predecessor.
 */
function isStrictlyIncreasing(values: readonly number[]): boolean {
  let previous = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value <= previous) return false;
    previous = value;
  }
  return true;
}

/**
 * Schema for one tenant's term calendar: its terms, oldest first. An empty calendar is valid
 * and means the tenant supplied no terms, so nothing can be ordered by term.
 */
export const TermCalendarSchema = z
  .array(TermSchema)
  .readonly()
  // SAFETY: term codes and sequences are tenant-specific, so mixing tenants would order one
  // tenant's attempts by another tenant's calendar.
  .refine((terms) => terms.every((term) => term.tenantId === terms[0]?.tenantId), {
    message: 'All terms in a calendar must belong to one tenant',
  })
  // SAFETY: a repeated term code would give one attempt's term two positions, so "most
  // recent" could depend on which one was found first.
  .refine((terms) => new Set(terms.map((term) => term.termCode)).size === terms.length, {
    message: 'termCode must be unique within a tenant',
  })
  // SAFETY: the order is by `sequence` alone, so each term must be strictly later than the one
  // before it. A tie would leave two terms unordered.
  .refine((terms) => isStrictlyIncreasing(terms.map((term) => term.sequence)), {
    message: 'Terms must be listed in strictly increasing sequence',
  });

/** A validated, immutable term calendar, oldest term first. */
export type TermCalendar = z.infer<typeof TermCalendarSchema>;

/** Raw input accepted by {@link createTermCalendar}. */
export type TermCalendarInput = z.input<typeof TermCalendarSchema>;

/**
 * Creates a validated, immutable term calendar.
 *
 * @param input - One tenant's terms, oldest first.
 * @returns The parsed term calendar.
 * @throws {z.ZodError} When a term is invalid, the terms belong to more than one tenant, a
 *   `termCode` repeats, or the `sequence` values are not strictly increasing.
 */
export function createTermCalendar(input: TermCalendarInput): TermCalendar {
  return TermCalendarSchema.parse(input);
}
