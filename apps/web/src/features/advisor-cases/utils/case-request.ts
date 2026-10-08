/**
 * @file Builds the create-case request from what the student has chosen and typed. The preview
 * and the hidden form field both render this one value.
 * @module @caa/web/features/advisor-cases/utils/case-request
 * @requirement FR-12
 * @requirement FR-17
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { CreateCaseRequest } from '@caa/api-contract';
import { CaseReason, type DiscrepancySubject, type PlanRevisionId } from '@caa/domain';

/**
 * Builds a plan-review or needs-verification request.
 *
 * @param reason - `PLAN_REVIEW` or `NEEDS_VERIFICATION`.
 * @param planRevisionId - The revision being shown, which the case freezes.
 * @param note - The text typed. It is trimmed, as the API does.
 * @returns The request body.
 */
export function buildPlanCaseRequest(
  reason: typeof CaseReason.PlanReview | typeof CaseReason.NeedsVerification,
  planRevisionId: PlanRevisionId,
  note: string,
): CreateCaseRequest {
  return {
    reason,
    planRevisionId,
    discrepancySubject: null,
    studentNote: note.trim(),
  };
}

/**
 * Builds a source-discrepancy request.
 *
 * @param subject - What the student says is wrong.
 * @param note - The text typed. It is trimmed, as the API does.
 * @returns The request body, with no plan revision.
 */
export function buildDiscrepancyRequest(
  subject: DiscrepancySubject,
  note: string,
): CreateCaseRequest {
  return {
    reason: CaseReason.SourceDiscrepancy,
    planRevisionId: null,
    discrepancySubject: subject,
    studentNote: note.trim(),
  };
}
