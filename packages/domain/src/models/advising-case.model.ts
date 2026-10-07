/**
 * @file Advising case data object: a student's app-internal request for advisor attention.
 * @module @caa/domain/models/advising-case
 * @requirement FR-12, FR-14, FR-17
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { z } from 'zod';

import { CaseReason, CaseReasonSchema } from '../enums/case-reason.enum';
import { CaseStatus, CaseStatusSchema } from '../enums/case-status.enum';
import { DiscrepancySubjectSchema } from '../enums/discrepancy-subject.enum';
import { InstitutionIdSchema } from './institution.model';
import { PlanRevisionIdSchema } from './plan-revision.model';
import { StudentIdSchema } from './student.model';
import { UserIdSchema } from './user-identity.model';

/** Branded ID so a case ID can never be passed where another ID is expected. */
export const CaseIdSchema = z.uuid().brand<'CaseId'>();

/** Unique identifier of an {@link AdvisingCase}. */
export type CaseId = z.infer<typeof CaseIdSchema>;

/** Longest student note, in characters. */
export const STUDENT_NOTE_MAX_LENGTH = 500;

/**
 * Returns whether a plan revision is present when the reason needs one: every reason except a
 * source discrepancy. Shared by this model and the case request contract.
 *
 * @param reason - Why the case is opened.
 * @param planRevisionId - The referenced plan revision, or `null`.
 * @returns `true` when the revision requirement is met.
 */
export function hasRequiredPlanRevision(
  reason: CaseReason,
  planRevisionId: string | null,
): boolean {
  return reason === CaseReason.SourceDiscrepancy || planRevisionId !== null;
}

/**
 * Returns whether a discrepancy subject is present exactly when the reason is a source
 * discrepancy. Shared by this model and the case request contract.
 *
 * @param reason - Why the case is opened.
 * @param discrepancySubject - What is disputed, or `null`.
 * @returns `true` when the subject matches the reason.
 */
export function hasMatchingDiscrepancySubject(
  reason: CaseReason,
  discrepancySubject: string | null,
): boolean {
  return (reason === CaseReason.SourceDiscrepancy) === (discrepancySubject !== null);
}

/**
 * Returns whether an owner is present exactly when the status is IN_REVIEW or RESOLVED. Shared by
 * this model and the case view contract.
 *
 * @param status - The case status.
 * @param hasOwner - Whether the case has an owner.
 * @returns `true` when ownership matches the status.
 */
export function isCaseOwnerConsistent(status: CaseStatus, hasOwner: boolean): boolean {
  return (status === CaseStatus.InReview || status === CaseStatus.Resolved) === hasOwner;
}

/** Schema for an advising case. */
export const AdvisingCaseSchema = z
  .object({
    id: CaseIdSchema,
    tenantId: InstitutionIdSchema,
    studentId: StudentIdSchema,
    reason: CaseReasonSchema,
    /** The frozen plan revision under review. Optional only for a source discrepancy. */
    planRevisionId: PlanRevisionIdSchema.nullable(),
    /** What is disputed. Present exactly when the reason is a source discrepancy. */
    discrepancySubject: DiscrepancySubjectSchema.nullable(),
    /** The student's note for the advisor. Never logged or sent to a model. */
    studentNote: z.string().trim().min(1).max(STUDENT_NOTE_MAX_LENGTH),
    status: CaseStatusSchema,
    /** The claiming advisor, or the resolver once resolved. */
    ownerUserId: UserIdSchema.nullable(),
    /** ISO 8601 with offset. */
    createdAt: z.iso.datetime({ offset: true }),
    /** Sequence of the latest event; the basis for optimistic concurrency. */
    lastSequence: z.number().int().min(1),
  })
  // SAFETY: a plan review without a plan, or a discrepancy without a subject, is unreviewable.
  .refine((c) => hasRequiredPlanRevision(c.reason, c.planRevisionId), {
    message: 'planRevisionId is required unless the reason is SOURCE_DISCREPANCY',
    path: ['planRevisionId'],
  })
  // SAFETY: a discrepancy subject on another reason would misroute the report (FR-17).
  .refine((c) => hasMatchingDiscrepancySubject(c.reason, c.discrepancySubject), {
    message: 'discrepancySubject is present exactly when the reason is SOURCE_DISCREPANCY',
    path: ['discrepancySubject'],
  })
  // SAFETY: ownership must match status so no case is silently unowned in review or unattributed once resolved.
  .refine((c) => isCaseOwnerConsistent(c.status, c.ownerUserId !== null), {
    message: 'ownerUserId is set exactly when the status is IN_REVIEW or RESOLVED',
    path: ['ownerUserId'],
  })
  .readonly();

/** A validated, immutable advising case. */
export type AdvisingCase = z.infer<typeof AdvisingCaseSchema>;

/** Raw input accepted by {@link createAdvisingCase}. */
export type AdvisingCaseInput = z.input<typeof AdvisingCaseSchema>;

/**
 * Creates a validated, immutable advising case.
 *
 * @param input - Raw case fields.
 * @returns The parsed case.
 * @throws {z.ZodError} When a field or a cross-field rule is violated.
 */
export function createAdvisingCase(input: AdvisingCaseInput): AdvisingCase {
  return AdvisingCaseSchema.parse(input);
}
