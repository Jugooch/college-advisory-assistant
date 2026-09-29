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
 * Schema for the time required to get from one campus to another between two meetings.
 * The pair is ordered: going from A to B may take a different time than going from B to A.
 */
export const CampusTransitionSchema = z
  .object({
    /** Campus of the meeting that ends first. */
    fromCampusId: CampusIdSchema,
    /** Campus of the meeting that starts next. May equal `fromCampusId` for same-campus time. */
    toCampusId: CampusIdSchema,
    /** Whole minutes required between the end of one meeting and the start of the next. */
    minutes: z.number().int().nonnegative(),
  })
  .readonly();

/** A validated, immutable campus transition. */
export type CampusTransition = z.infer<typeof CampusTransitionSchema>;

/**
 * Schema for one tenant's campus transition policy in one ruleset version. Every value is
 * institution configuration, never a default built into code.
 *
 * The policy lists only the ordered pairs the institution supplied. A pair that isn't listed
 * is unknown, never zero minutes: the engine reports the affected schedule option as UNKNOWN,
 * never as feasible (AC08). That includes the same-campus pair, so an institution that allows
 * back-to-back meetings on one campus lists that pair with `0` minutes.
 */
export const CampusTransitionPolicySchema = z
  .object({
    tenantId: InstitutionIdSchema,
    /** Published ruleset version this policy belongs to, for example `demo-2026.1`. */
    rulesetVersion: z.string().min(1),
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
 * @throws {z.ZodError} When a field is invalid or an ordered campus pair repeats.
 */
export function createCampusTransitionPolicy(
  input: CampusTransitionPolicyInput,
): CampusTransitionPolicy {
  return CampusTransitionPolicySchema.parse(input);
}
