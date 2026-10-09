/**
 * @file Tests for the case preview: drafts follow the case schema, and the preview has an empty
 * note and the fixed queue label.
 * @requirement FR-14
 * @requirement FR-16
 */
import { describe, expect, it } from 'vitest';

import { AssistantBlockKind, CaseReason, DiscrepancySubject } from '@caa/domain';
import { buildPlanRevisionView } from '@caa/test-kit';

import {
  buildCasePreviewBlock,
  isValidCaseDraft,
  pickCurrentPlan,
  reasonNeedsPlan,
} from './conversation-tool-case-preview.logic';

describe('reasonNeedsPlan', () => {
  it('follows the case schema for every reason', () => {
    expect(reasonNeedsPlan(CaseReason.PlanReview)).toBe(true);
    expect(reasonNeedsPlan(CaseReason.NeedsVerification)).toBe(true);
    expect(reasonNeedsPlan(CaseReason.SourceDiscrepancy)).toBe(false);
  });
});

describe('pickCurrentPlan', () => {
  const newest = { id: buildPlanRevisionView().planId, termId: 'term-b', latestRevision: 3 };
  const older = { id: newest.id, termId: 'term-a', latestRevision: 1 };

  it('takes the first plan when no term is confirmed', () => {
    expect(pickCurrentPlan([newest, older], undefined)).toEqual({
      planId: newest.id,
      revision: 3,
    });
  });

  it('takes the first plan in the confirmed term', () => {
    expect(pickCurrentPlan([newest, older], 'term-a')).toEqual({ planId: older.id, revision: 1 });
  });

  it('returns null when no plan matches', () => {
    expect(pickCurrentPlan([newest], 'term-z')).toBeNull();
    expect(pickCurrentPlan([], undefined)).toBeNull();
  });
});

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
