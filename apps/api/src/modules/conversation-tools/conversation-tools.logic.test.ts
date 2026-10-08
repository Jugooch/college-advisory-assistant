/**
 * @file Tests for the pure tool logic: projections hold no forbidden field, proposals are
 * PREFERRED, case drafts follow the reason rules, and notices use fixed text.
 * @requirement FR-08
 * @requirement FR-10
 * @requirement FR-14
 * @requirement AC43
 */
import { describe, expect, it } from 'vitest';

import {
  AssistantBlockKind,
  CaseReason,
  ConstraintStrength,
  DiscrepancySubject,
} from '@caa/domain';
import {
  buildAcademicSummaryResponse,
  buildPlanRevisionView,
  buildPolicyHit,
  buildScheduleOptionsResponse,
  buildUnavailableTime,
} from '@caa/test-kit';

import {
  buildCasePreviewBlock,
  isValidCaseDraft,
  projectAcademicSummary,
  projectCasePreview,
  projectConstraintProposal,
  projectPlanEvidence,
  projectPolicyResults,
  projectScheduleOptions,
  toProposals,
} from './conversation-tools.logic';

const FORBIDDEN =
  /email|name|studentId|userId|tenantId|grade|note|documentKey|[0-9a-f]{8}-[0-9a-f]{4}-/i;

describe('projections', () => {
  it('hold no name, email, ID, grade or note field', () => {
    const projections = [
      projectAcademicSummary(buildAcademicSummaryResponse()),
      projectScheduleOptions(buildScheduleOptionsResponse()),
      projectPlanEvidence(buildPlanRevisionView()),
      projectConstraintProposal(toProposals([buildUnavailableTime()])),
      projectCasePreview(CaseReason.PlanReview, true),
    ];

    for (const projection of projections) {
      expect(JSON.stringify(projection)).not.toMatch(FORBIDDEN);
    }
  });

  it('keeps policy text but drops the document key', () => {
    const hit = buildPolicyHit({ title: 'Late registration', excerpt: 'Closes on day five.' });

    const projection = projectPolicyResults({ hits: [hit], asOf: '2026-09-22T15:00:00.000Z' });

    expect(JSON.stringify(projection)).toContain('Closes on day five.');
    expect(JSON.stringify(projection)).not.toContain(hit.documentKey);
  });

  it('counts requirements by state in a stable order', () => {
    const projection = projectAcademicSummary(buildAcademicSummaryResponse());

    expect(projection).toMatchObject({ auditAvailable: true });
    expect(
      Object.keys((projection as { requirementsByState: object }).requirementsByState),
    ).toEqual(
      [...Object.keys((projection as { requirementsByState: object }).requirementsByState)].sort(),
    );
  });
});

describe('toProposals', () => {
  it('makes every constraint PREFERRED, ranked in order and unconfirmed', () => {
    const proposals = toProposals([buildUnavailableTime(), buildUnavailableTime()]);

    expect(proposals.map((proposal) => proposal.constraint.strength)).toEqual([
      ConstraintStrength.Preferred,
      ConstraintStrength.Preferred,
    ]);
    expect(proposals.map((proposal) => proposal.constraint.priorityRank)).toEqual([1, 2]);
    expect(proposals.map((proposal) => proposal.confirmed)).toEqual([false, false]);
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
