/**
 * @file Lifecycle status of an advisor case.
 * @module @caa/domain/enums/case-status
 * @requirement FR-12
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { z } from 'zod';

/** Lifecycle status of an advisor case. The transition table lives in the api, not here. */
export const CaseStatus = {
  /** Created and waiting for an advisor. */
  Open: 'OPEN',
  /** Claimed by an advisor. */
  InReview: 'IN_REVIEW',
  /** Closed by an advisor with a resolution. Final. */
  Resolved: 'RESOLVED',
  /** Closed by the student. Final. */
  Withdrawn: 'WITHDRAWN',
} as const;

/** Union of every {@link CaseStatus} value. */
export type CaseStatus = (typeof CaseStatus)[keyof typeof CaseStatus];

/** Runtime schema for {@link CaseStatus}. */
export const CaseStatusSchema = z.enum(CaseStatus);
