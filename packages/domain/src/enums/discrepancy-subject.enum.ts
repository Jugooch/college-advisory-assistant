/**
 * @file The kind of record a discrepancy case disputes.
 * @module @caa/domain/enums/discrepancy-subject
 * @requirement FR-17
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { z } from 'zod';

/** The kind of record a discrepancy report disputes. The record itself is never changed. */
export const DiscrepancySubject = {
  /** A program or catalog entry. */
  ProgramOrCatalog: 'PROGRAM_OR_CATALOG',
  /** A course attempt on the transcript. */
  CourseAttempt: 'COURSE_ATTEMPT',
  /** A requirement line in the degree audit. */
  AuditRequirement: 'AUDIT_REQUIREMENT',
  /** A section in the schedule. */
  Section: 'SECTION',
} as const;

/** Union of every {@link DiscrepancySubject} value. */
export type DiscrepancySubject = (typeof DiscrepancySubject)[keyof typeof DiscrepancySubject];

/** Runtime schema for {@link DiscrepancySubject}. */
export const DiscrepancySubjectSchema = z.enum(DiscrepancySubject);
