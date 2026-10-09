/**
 * @file The query names a chat case preview uses to hand off to the case forms. The chat builds
 * the link and the case pages read it, so the names live here, once.
 * @module @caa/web/shared/utils/case-handoff-query
 * @requirement FR-12
 * @requirement FR-17
 * @see docs/adr/0007-web-feature-and-shared-layout.md
 */

/** The query names of the case handoff link. */
export const HandoffQuery = {
  /** The student, taken from the page URL. */
  StudentId: 'studentId',
  /** The disputed subject of a source-discrepancy report. */
  Subject: 'subject',
  /** The plan to ask an advisor about. */
  PlanId: 'planId',
  /** The plan revision to ask about. */
  Revision: 'revision',
  /** The case reason. */
  Reason: 'reason',
} as const;
