/**
 * @file Reads the optional query values a chat case preview passes to the case forms: the reason,
 * the plan revision, and the disputed subject. The student still writes the note; nothing is
 * submitted by following the link.
 * @module @caa/web/features/advisor-cases/utils/handoff-query
 * @requirement FR-12
 * @requirement FR-17
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { CaseReason, DiscrepancySubject } from '@caa/domain';

/** The two reasons a plan can be sent for review. */
export type PlanCaseReason = typeof CaseReason.PlanReview | typeof CaseReason.NeedsVerification;

/**
 * Reads the plan case reason, defaulting to a plan review.
 *
 * @param value - The raw `reason` query value.
 * @returns The reason, or `PLAN_REVIEW` when it is missing or not a plan reason.
 */
export function readPlanReasonQuery(value: string | readonly string[] | undefined): PlanCaseReason {
  return value === CaseReason.NeedsVerification
    ? CaseReason.NeedsVerification
    : CaseReason.PlanReview;
}

/**
 * Reads the plan revision to ask about.
 *
 * @param value - The raw `revision` query value.
 * @param latest - The plan's latest revision number.
 * @returns An earlier revision to open, or `null` for the latest.
 */
export function readHandoffRevision(
  value: string | readonly string[] | undefined,
  latest: number,
): number | null {
  // SECURITY: only a plain digit string within 1..latest reaches the API path (standard 09).
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,8}$/.test(value)) {
    return null;
  }
  const revision = Number(value);
  return revision < latest ? revision : null;
}

/**
 * Reads the disputed subject, defaulting to the form's first choice.
 *
 * @param value - The raw `subject` query value.
 * @returns The subject.
 */
export function readSubjectQuery(
  value: string | readonly string[] | undefined,
): DiscrepancySubject {
  const match = Object.values(DiscrepancySubject).find((subject) => subject === value);
  return match ?? DiscrepancySubject.ProgramOrCatalog;
}
