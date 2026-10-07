/**
 * @file Why a plan revision was appended.
 * @module @caa/domain/enums/plan-revision-cause
 * @requirement FR-11
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { z } from 'zod';

/**
 * Cause of a revision: `SAVED` when the student saved a draft, `REVALIDATED` when the server
 * replayed the stored inputs on current sources (ADR-0013 §4).
 */
export const PlanRevisionCause = {
  Saved: 'SAVED',
  Revalidated: 'REVALIDATED',
} as const;

/** Union of every {@link PlanRevisionCause} value. */
export type PlanRevisionCause = (typeof PlanRevisionCause)[keyof typeof PlanRevisionCause];

/** Runtime schema for {@link PlanRevisionCause}. */
export const PlanRevisionCauseSchema = z.enum(PlanRevisionCause);
