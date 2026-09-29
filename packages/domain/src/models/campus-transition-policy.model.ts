/**
 * @file Campus transition policy: the minutes a tenant requires between meetings on two campuses.
 * @module @caa/domain/models/campus-transition-policy
 * @requirement FR-07
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { z } from 'zod';

import { CampusIdSchema } from './campus.model';
import { InstitutionIdSchema } from './institution.model';

/**
 * Schema for the time required to get from one campus to a different campus between two
 * meetings. The pair is ordered: going from A to B may take a different time than B to A.
 */
export const CampusTransitionSchema = z
  .object({
    /** Campus of the meeting that ends first. */
    fromCampusId: CampusIdSchema,
    /** Campus of the meeting that starts next. Always a different campus. */
    toCampusId: CampusIdSchema,
    /** Whole minutes required between the end of one meeting and the start of the next. */
    minutes: z.number().int().nonnegative(),
  })
  // NOTE: two meetings on the same campus need no transition (ADR-0010 §8), so a same-campus
  // entry would be a second, conflicting source for a rule the engine already fixes.
  .refine((pair) => pair.fromCampusId !== pair.toCampusId, {
    message: 'fromCampusId and toCampusId must be different campuses',
    path: ['toCampusId'],
  })
  .readonly();

/** A validated, immutable campus transition. */
export type CampusTransition = z.infer<typeof CampusTransitionSchema>;

/**
 * Returns whether the gap between two meetings allows the institution's required transition.
 * A gap exactly equal to the required minutes is enough. Shared invariant (ADR-0005): the
 * engine's transition check and the schedule-issue schema both call it.
 *
 * @param gapMinutes - Minutes from the earlier meeting's end to the later meeting's start.
 * @param transition - The configured transition for the ordered campus pair.
 * @returns `false` when the gap is shorter than the required minutes.
 */
export function hasEnoughTransitionTime(
  gapMinutes: number,
  transition: Pick<CampusTransition, 'minutes'>,
): boolean {
  // SAFETY: a gap shorter than the configured time is a travel conflict (AC08), and the rule
  // only applies to a configured pair; an unconfigured one is UNKNOWN (ADR-0010 §8).
  return gapMinutes >= transition.minutes;
}

/**
 * Schema for one version of a tenant's campus transition table. Every value is institution
 * configuration, never a default built into code.
 *
 * The table lists only the ordered pairs of different campuses the institution supplied. A
 * pair of different campuses that isn't listed is unknown, never zero minutes: the engine
 * reports the affected schedule option as UNKNOWN (`TRANSITION_TIME_UNDEFINED`), never as
 * feasible (AC08). Meetings on the same campus, and online meetings, need no transition.
 */
export const CampusTransitionPolicySchema = z
  .object({
    tenantId: InstitutionIdSchema,
    /**
     * Version of this tenant's transition table, for example `demo-2026.1`. Schedule options
     * pin it as `campusTransitionVersion`, so a changed table is a new version.
     */
    version: z.string().min(1),
    /** The ordered campus pairs the institution supplied. An empty list means none. */
    transitions: z.array(CampusTransitionSchema).readonly(),
  })
  // SAFETY: a repeated ordered pair would give one trip two required times, so whether two
  // meetings conflict could depend on which entry the engine found first.
  .refine(
    (policy) =>
      new Set(policy.transitions.map((pair) => `${pair.fromCampusId}>${pair.toCampusId}`)).size ===
      policy.transitions.length,
    { message: 'Each ordered campus pair may appear at most once', path: ['transitions'] },
  )
  .readonly();

/** A validated, immutable campus transition policy. */
export type CampusTransitionPolicy = z.infer<typeof CampusTransitionPolicySchema>;

/** Raw input accepted by {@link createCampusTransitionPolicy}. */
export type CampusTransitionPolicyInput = z.input<typeof CampusTransitionPolicySchema>;

/**
 * Creates a validated, immutable campus transition policy.
 *
 * @param input - Raw policy fields.
 * @returns The parsed campus transition policy.
 * @throws {z.ZodError} When a field is invalid, a pair names one campus twice, or an ordered
 *   campus pair repeats.
 */
export function createCampusTransitionPolicy(
  input: CampusTransitionPolicyInput,
): CampusTransitionPolicy {
  return CampusTransitionPolicySchema.parse(input);
}
