/**
 * @file Tests for the draft_case_context runner, driven through the tools service: a preview with
 * an empty note that creates nothing.
 * @requirement FR-16
 * @requirement AC44
 */
import { describe, expect, it } from 'vitest';

import { ToolName } from '@caa/assistant';
import {
  AssistantBlockKind,
  CaseReason,
  DiscrepancySubject,
  ErrorCode,
  NoticeCode,
} from '@caa/domain';

import {
  otherPlanId,
  ownPlan,
  ownStudent,
  setupTools,
  studentActor,
} from '../../testing/conversation-tools-harness';
import { scheduleRequest } from '../../testing/schedule-options-harness';

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

  it('refuses a model-written note', async () => {
    const outcome = await setupTools().run(ToolName.DraftCaseContext, {
      reason: CaseReason.PlanReview,
      suggestedNote: 'hi',
    });

    expect(outcome.errorCode).toBe('INVALID_ARGUMENTS');
  });

  it("pins a plan review without a plan id to the student's latest saved plan", async () => {
    const { run, listPlans } = setupTools();

    const outcome = await run(ToolName.DraftCaseContext, { reason: CaseReason.PlanReview });

    expect(outcome.block).toMatchObject({
      kind: AssistantBlockKind.CasePreview,
      reason: CaseReason.PlanReview,
      planId: ownPlan.id,
      planRevision: 1,
    });
    expect(outcome.projection).toEqual({
      reason: CaseReason.PlanReview,
      hasPlan: true,
      submitted: false,
    });
    expect(JSON.stringify(outcome.projection)).not.toContain(ownPlan.id);
    expect(listPlans).toHaveBeenCalledWith(expect.anything(), ownStudent.id, expect.anything());
  });

  it('gives the fixed planner-input notice and no preview when no plan is saved', async () => {
    const outcome = await setupTools({ noSavedPlan: true }).run(ToolName.DraftCaseContext, {
      reason: CaseReason.PlanReview,
    });

    expect(outcome.block).toBeNull();
    expect(outcome.errorCode).toBeNull();
    expect(outcome.notice).toMatchObject({
      kind: AssistantBlockKind.Notice,
      code: NoticeCode.PlannerInputNeeded,
      text: 'More information is needed before a schedule can be built. Use the planning form to add the missing choices.',
    });
    expect(outcome.projection).toEqual({ plannerInputNeeded: true });
  });

  it("picks the plan for the planner form's term", async () => {
    const { run, listPlans } = setupTools();
    const { plans } = await listPlans(studentActor, ownStudent.id);
    const other = plans.map((p) => ({ ...p, id: otherPlanId, termId: 'term-other' as never }));
    listPlans.mockResolvedValueOnce({ plans: [...other, ...plans] });

    const outcome = await run(
      ToolName.DraftCaseContext,
      { reason: CaseReason.PlanReview },
      { plannerInputs: { ...scheduleRequest(), termId: ownPlan.termId } },
    );

    expect(outcome.block).toMatchObject({ planId: ownPlan.id });
  });

  it('gives the fixed notice when the only plan is in another term', async () => {
    const outcome = await setupTools().run(
      ToolName.DraftCaseContext,
      { reason: CaseReason.PlanReview },
      { plannerInputs: { ...scheduleRequest(), termId: 'term-other' as never } },
    );

    expect(outcome.block).toBeNull();
    expect(outcome.notice).toMatchObject({ code: NoticeCode.PlannerInputNeeded });
  });

  it('resolves the current plan for a needs-verification draft without a plan id', async () => {
    const outcome = await setupTools().run(ToolName.DraftCaseContext, {
      reason: CaseReason.NeedsVerification,
    });

    expect(outcome.block).toMatchObject({
      reason: CaseReason.NeedsVerification,
      planId: ownPlan.id,
    });
  });

  it('does not look up a plan for a source discrepancy without a plan id', async () => {
    const { run, listPlans } = setupTools();

    await run(ToolName.DraftCaseContext, {
      reason: CaseReason.SourceDiscrepancy,
      discrepancySubject: DiscrepancySubject.CourseAttempt,
    });

    expect(listPlans).not.toHaveBeenCalled();
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
