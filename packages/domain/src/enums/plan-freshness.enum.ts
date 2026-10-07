/**
 * @file Freshness of a saved plan revision, and the reasons it is stale or unknown.
 * @module @caa/domain/enums/plan-freshness
 * @requirement FR-11
 * @requirement NFR-04
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { z } from 'zod';

/**
 * Whether a saved revision still matches today's sources, derived on the server at read time
 * and never stored (ADR-0013 §3). `UNKNOWN` is never shown as `CURRENT`.
 * - `CURRENT`: every pinned input is still the latest and within the allowed age.
 * - `STALE`: a pinned input was superseded or is past the allowed age.
 * - `UNKNOWN`: a current source can't be read, or two current records tie for latest.
 */
export const PlanFreshness = {
  Current: 'CURRENT',
  Stale: 'STALE',
  Unknown: 'UNKNOWN',
} as const;

/** Union of every {@link PlanFreshness} value. */
export type PlanFreshness = (typeof PlanFreshness)[keyof typeof PlanFreshness];

/** Runtime schema for {@link PlanFreshness}. */
export const PlanFreshnessSchema = z.enum(PlanFreshness);

/**
 * Why a revision is stale or unknown (ADR-0013 §3). These are not `ReasonCode` values.
 * - `STUDENT_RECORD_SUPERSEDED`, `AUDIT_SUPERSEDED`, `SECTIONS_SUPERSEDED`: a newer snapshot exists.
 * - `RULESET_CHANGED`, `TRANSITION_TABLE_CHANGED`: the active version differs from the pinned one.
 * - `SOURCE_EXPIRED`: a pinned time is past `ACADEMIC_SOURCE_MAX_AGE_MS`.
 * - `SOURCE_UNAVAILABLE`: a current source could not be read.
 */
export const PlanStaleReason = {
  StudentRecordSuperseded: 'STUDENT_RECORD_SUPERSEDED',
  AuditSuperseded: 'AUDIT_SUPERSEDED',
  SectionsSuperseded: 'SECTIONS_SUPERSEDED',
  RulesetChanged: 'RULESET_CHANGED',
  TransitionTableChanged: 'TRANSITION_TABLE_CHANGED',
  SourceExpired: 'SOURCE_EXPIRED',
  SourceUnavailable: 'SOURCE_UNAVAILABLE',
} as const;

/** Union of every {@link PlanStaleReason} value. */
export type PlanStaleReason = (typeof PlanStaleReason)[keyof typeof PlanStaleReason];

/** Runtime schema for {@link PlanStaleReason}. */
export const PlanStaleReasonSchema = z.enum(PlanStaleReason);
