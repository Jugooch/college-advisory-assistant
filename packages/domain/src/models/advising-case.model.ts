/**
 * @file Advising case data object: a student's app-internal request for advisor attention.
 * @module @caa/domain/models/advising-case
 * @requirement FR-12, FR-14, FR-17
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { z } from 'zod';

import {
  CaseReasonSchema,
  isCasePlanSatisfied,
  isCaseSubjectConsistent,
} from '../enums/case-reason.enum';
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
  .refine((c) => isCasePlanSatisfied(c.reason, c.planRevisionId !== null), {
    message: 'planRevisionId is required unless the reason is SOURCE_DISCREPANCY',
    path: ['planRevisionId'],
  })
  // SAFETY: a discrepancy subject on another reason would misroute the report (FR-17).
  .refine((c) => isCaseSubjectConsistent(c.reason, c.discrepancySubject !== null), {
    message: 'discrepancySubject is present exactly when the reason is SOURCE_DISCREPANCY',
    path: ['discrepancySubject'],
  })
  // SAFETY: ownership must match status so no case is silently unowned in review or unattributed once resolved.
  .refine(
    (c) =>
      (c.status === CaseStatus.InReview || c.status === CaseStatus.Resolved) ===
      (c.ownerUserId !== null),
    {
      message: 'ownerUserId is set exactly when the status is IN_REVIEW or RESOLVED',
      path: ['ownerUserId'],
    },
  )
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
