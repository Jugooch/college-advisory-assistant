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

/**
 * Returns whether a case's subject agrees with its reason: a discrepancy subject is present
 * exactly when the reason is SOURCE_DISCREPANCY.
 *
 * @param reason - Why the case is opened.
 * @param hasSubject - Whether a discrepancy subject is set.
 * @returns `true` when the pair is consistent.
 */
export const isCaseSubjectConsistent = (reason: CaseReason, hasSubject: boolean): boolean =>
  (reason === CaseReason.SourceDiscrepancy) === hasSubject;

/**
 * Returns whether a case has the plan its reason needs: every reason except SOURCE_DISCREPANCY
 * is a review of a plan.
 *
 * @param reason - Why the case is opened.
 * @param hasPlan - Whether a plan is attached.
 * @returns `true` when the plan requirement holds.
 */
export const isCasePlanSatisfied = (reason: CaseReason, hasPlan: boolean): boolean =>
  reason === CaseReason.SourceDiscrepancy || hasPlan;
