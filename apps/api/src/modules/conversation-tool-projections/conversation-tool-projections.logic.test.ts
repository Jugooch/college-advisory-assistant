/**
 * @file Tests for the model projections: no forbidden field, policy text kept, stable counts,
 * and the program/catalog qualifier passed through.
 * @requirement FR-01
 * @requirement FR-10
 * @requirement AC43
 */
import { describe, expect, it } from 'vitest';

import { CaseReason, CheckState, ReasonCode } from '@caa/domain';
import {
  buildAcademicSummaryResponse,
  buildPlanRevisionView,
  buildPolicyHit,
  buildScheduleOptionsResponse,
  buildUnavailableTime,
} from '@caa/test-kit';

import { projectCasePreview } from '../conversation-tool-case-preview/conversation-tool-case-preview.logic';
import { toProposals } from '../conversation-tool-proposals/conversation-tool-proposals.logic';
import {
  projectAcademicSummary,
  projectConstraintProposal,
  projectPlanEvidence,
  projectPolicyResults,
  projectScheduleOptions,
} from './conversation-tool-projections.logic';

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

  it('passes the program and catalog check state through, so UNKNOWN is never hidden', () => {
    const base = buildAcademicSummaryResponse();
    const summary = {
      ...base,
      programCatalogConsistency: {
        state: CheckState.Unknown,
        reasonCode: ReasonCode.AuditProgramMismatch,
      },
    };

    expect(projectAcademicSummary(summary)).toMatchObject({
      programCatalogConsistency: CheckState.Unknown,
    });
  });
});
