/**
 * @file Tests for the draft_case_context runner, driven through the tools service: a preview with
 * an empty note that creates nothing.
 * @requirement FR-16
 * @requirement AC44
 */
import { describe, expect, it } from 'vitest';

import { ToolName } from '@caa/assistant';
import { AssistantBlockKind, CaseReason, ErrorCode } from '@caa/domain';

import { otherPlanId, ownPlan, setupTools } from '../../testing/conversation-tools-harness';

describe('draft_case_context', () => {
  it('previews a plan review with an empty note and creates nothing', async () => {
    const outcome = await setupTools().run(ToolName.DraftCaseContext, {
      reason: CaseReason.PlanReview,
      planId: ownPlan.id,
    });

    expect(outcome.block).toMatchObject({
      kind: AssistantBlockKind.CasePreview,
      reason: CaseReason.PlanReview,
      planId: ownPlan.id,
      planRevision: 1,
      discrepancySubject: null,
      suggestedNote: '',
    });
    expect(outcome.projection).toEqual({
      reason: CaseReason.PlanReview,
      hasPlan: true,
      submitted: false,
    });
  });

  it('refuses a note or a plan review without a plan', async () => {
    const { run } = setupTools();

    expect(
      (await run(ToolName.DraftCaseContext, { reason: CaseReason.PlanReview, suggestedNote: 'hi' }))
        .errorCode,
    ).toBe('INVALID_ARGUMENTS');
    expect(
      (await run(ToolName.DraftCaseContext, { reason: CaseReason.PlanReview })).errorCode,
    ).toBe('INVALID_ARGUMENTS');
  });

  it("gives NOT_FOUND for another student's plan", async () => {
    const outcome = await setupTools().run(ToolName.DraftCaseContext, {
      reason: CaseReason.PlanReview,
      planId: otherPlanId,
    });

    expect(outcome.errorCode).toBe(ErrorCode.NotFound);
    expect(outcome.block).toBeNull();
  });
});
