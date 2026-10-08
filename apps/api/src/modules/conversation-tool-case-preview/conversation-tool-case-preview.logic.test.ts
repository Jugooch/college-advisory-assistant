/**
 * @file Tests for the case preview: drafts follow the case schema, and the preview has an empty
 * note and the fixed queue label.
 * @requirement FR-14
 * @requirement FR-16
 */
import { describe, expect, it } from 'vitest';

import { AssistantBlockKind, CaseReason, DiscrepancySubject } from '@caa/domain';
import { buildPlanRevisionView } from '@caa/test-kit';

import { buildCasePreviewBlock, isValidCaseDraft } from './conversation-tool-case-preview.logic';

describe('case drafts', () => {
  const planId = buildPlanRevisionView().planId;

  const subject = DiscrepancySubject.CourseAttempt;

  it('needs a plan and no subject for a plan review', () => {
    expect(isValidCaseDraft(CaseReason.PlanReview, planId, undefined)).toBe(true);
    expect(isValidCaseDraft(CaseReason.PlanReview, undefined, undefined)).toBe(false);
    expect(isValidCaseDraft(CaseReason.PlanReview, planId, subject)).toBe(false);
  });

  it('needs a subject for a source discrepancy', () => {
    expect(isValidCaseDraft(CaseReason.SourceDiscrepancy, undefined, subject)).toBe(true);
    expect(isValidCaseDraft(CaseReason.SourceDiscrepancy, undefined, undefined)).toBe(false);
  });

  it('builds a preview with an empty note and the fixed queue label', () => {
    const block = buildCasePreviewBlock(CaseReason.PlanReview, { planId, revision: 2 }, undefined);

    expect(block).toEqual({
      kind: AssistantBlockKind.CasePreview,
      reason: CaseReason.PlanReview,
      planId,
      planRevision: 2,
      discrepancySubject: null,
      suggestedNote: '',
      queueLabel: 'advisors assigned to you',
    });
  });
});
