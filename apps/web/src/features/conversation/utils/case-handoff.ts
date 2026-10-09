/**
 * @file Builds the link from a chat case preview to the existing case form. The link carries the
 * reason and the plan revision (or the disputed subject) and never a note or the transcript.
 * @module @caa/web/features/conversation/utils/case-handoff
 * @requirement FR-12
 * @requirement FR-17
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { AssistantBlock } from '@caa/api-contract';
import { CaseReason } from '@caa/domain';

import { HandoffQuery } from '@/shared/utils/case-handoff-query';

/** The case preview block. */
export type CasePreview = Extract<AssistantBlock, { kind: 'CASE_PREVIEW' }>;

/**
 * Names the case form the preview hands off to.
 *
 * @param preview - The preview block.
 * @param studentId - Internal student ID from the page URL.
 * @returns The path and query of the existing case form.
 */
export function caseHandoffHref(preview: CasePreview, studentId: string): string {
  const query = new URLSearchParams({ [HandoffQuery.StudentId]: studentId });
  if (preview.reason === CaseReason.SourceDiscrepancy) {
    if (preview.discrepancySubject !== null) {
      query.set(HandoffQuery.Subject, preview.discrepancySubject);
    }
    return `/report-a-problem?${query.toString()}`;
  }
  if (preview.planId !== null) {
    query.set(HandoffQuery.PlanId, preview.planId);
  }
  if (preview.planRevision !== null) {
    query.set(HandoffQuery.Revision, String(preview.planRevision));
  }
  query.set(HandoffQuery.Reason, preview.reason);
  return `/ask-an-advisor?${query.toString()}`;
}
