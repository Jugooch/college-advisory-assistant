/**
 * @file Why a case was opened.
 * @module @caa/domain/enums/case-reason
 * @requirement FR-12, FR-17
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { z } from 'zod';

/** Why a student opened an advisor case. */
export const CaseReason = {
  /** The student wants an advisor to review a saved plan. */
  PlanReview: 'PLAN_REVIEW',
  /** The plan has a result the student cannot clear alone. */
  NeedsVerification: 'NEEDS_VERIFICATION',
  /** The student reports that a source record looks wrong. Never alters the record. */
  SourceDiscrepancy: 'SOURCE_DISCREPANCY',
} as const;

/** Union of every {@link CaseReason} value. */
export type CaseReason = (typeof CaseReason)[keyof typeof CaseReason];

/** Runtime schema for {@link CaseReason}. */
export const CaseReasonSchema = z.enum(CaseReason);
