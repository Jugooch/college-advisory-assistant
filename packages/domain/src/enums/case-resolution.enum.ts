/**
 * @file How a resolved case was closed.
 * @module @caa/domain/enums/case-resolution
 * @requirement FR-12
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { z } from 'zod';

/** How an advisor resolved a case. A resolution is never a waiver (planning/08). */
export const CaseResolution = {
  /** The advisor reviewed the plan. */
  PlanReviewed: 'PLAN_REVIEWED',
  /** The student must act before the plan can proceed. */
  StudentActionNeeded: 'STUDENT_ACTION_NEEDED',
  /** The question belongs to an office outside this app. */
  ReferredOutsideApp: 'REFERRED_OUTSIDE_APP',
} as const;

/** Union of every {@link CaseResolution} value. */
export type CaseResolution = (typeof CaseResolution)[keyof typeof CaseResolution];

/** Runtime schema for {@link CaseResolution}. */
export const CaseResolutionSchema = z.enum(CaseResolution);
