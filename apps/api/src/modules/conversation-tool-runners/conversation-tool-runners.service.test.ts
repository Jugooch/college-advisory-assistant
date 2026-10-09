/**
 * @file Tests for the six tool runners through the tools service: each tool's success and
 * source-unavailable path, PREFERRED-only proposals, planner-input handling, and preview-only
 * case drafts.
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-08
 * @requirement FR-10
 * @requirement FR-16
 * @requirement AC43
 * @requirement AC44
 */
import { describe, expect, it } from 'vitest';

import { ToolName } from '@caa/assistant';
import {
  AssistantBlockKind,
  ConstraintStrength,
  ErrorCode,
  MAX_SCHEDULE_CONSTRAINTS,
  NoticeCode,
  PlanFreshness,
  PlanStaleReason,
  PolicyTopic,
} from '@caa/domain';
import { buildPlanFreshnessView, buildPlanRevisionView, buildUnavailableTime } from '@caa/test-kit';

import { SourceUnavailableError, StaleSourceError } from '../../shared/domain-errors';
import {
  otherPlanId,
  ownPlan,
  ownStudent,
  setupTools,
  studentActor,
  toolContext,
} from '../../testing/conversation-tools-harness';
import { scheduleRequest } from '../../testing/schedule-options-harness';

describe('get_academic_summary', () => {
  it('returns a summary block and a minimized, wrapped projection', async () => {
    const { run } = setupTools();

    const outcome = await run(ToolName.GetAcademicSummary, {});

    expect(outcome.errorCode).toBeNull();
    expect(outcome.block?.kind).toBe(AssistantBlockKind.AcademicSummary);
    expect(outcome.projection).toMatchObject({ auditAvailable: true });
    expect(outcome.modelText.startsWith('<tool_data tool="get_academic_summary">')).toBe(true);
  });

  it('reports SOURCE_UNAVAILABLE as a SOURCE_UNAVAILABLE notice with no block', async () => {
    const outcome = await setupTools({ missingRecord: true }).run(ToolName.GetAcademicSummary, {});

    expect(outcome.errorCode).toBe(ErrorCode.SourceUnavailable);
    expect(outcome.block).toBeNull();
    expect(outcome.notice).toMatchObject({
      kind: AssistantBlockKind.Notice,
      code: NoticeCode.SourceUnavailable,
      text: 'The information for this answer could not be reached right now, so nothing is shown as current. Use the planner and My plans for your saved work, and ask your advisor.',
      templateId: 'notice.source-unavailable',
    });
  });

  it('reports STALE_SOURCE as a STALE_SOURCE notice with no block', async () => {
    const { run, search } = setupTools();
    search.mockRejectedValueOnce(new StaleSourceError());

    const outcome = await run(ToolName.SearchApprovedPolicy, { query: 'late' });

    expect(outcome.errorCode).toBe(ErrorCode.StaleSource);
    expect(outcome.block).toBeNull();
    expect(outcome.notice).toMatchObject({
      kind: AssistantBlockKind.Notice,
      code: NoticeCode.StaleSource,
      text: 'The information for this answer is out of date and could not be confirmed, so nothing is shown as current. Use the planner and My plans for your saved work, and ask your advisor.',
      templateId: 'notice.stale-source',
    });
  });
});

describe('search_approved_policy', () => {
  it('returns policy results and quotable hit text only', async () => {
    const { run, search } = setupTools();

    const outcome = await run(ToolName.SearchApprovedPolicy, {
      query: 'late registration',
      topic: PolicyTopic.General,
    });

    expect(search).toHaveBeenCalledWith(
      studentActor,
      { q: 'late registration', topic: PolicyTopic.General },
      toolContext,
    );
    expect(outcome.block?.kind).toBe(AssistantBlockKind.PolicyResults);
    expect(outcome.projection).toEqual({
      hitCount: 1,
      hits: [
        {
          title: 'Late registration',
          topic: PolicyTopic.General,
          excerpt: 'Closes on day five.',
          conflict: false,
        },
      ],
    });
  });

  it('turns a failing source into TOOL_FAILED', async () => {
    const { run, search } = setupTools();
    search.mockRejectedValueOnce(new Error('db down'));

    const outcome = await run(ToolName.SearchApprovedPolicy, { query: 'late' });

    expect(outcome.errorCode).toBe(ErrorCode.InternalError);
    expect(outcome.notice).toMatchObject({
      code: NoticeCode.ToolFailed,
      text: 'Something went wrong while looking that up, so no result is shown. Please try again.',
      templateId: 'notice.tool-failed',
    });
    expect(JSON.stringify(outcome)).not.toContain('db down');
  });
});

describe('propose_constraints', () => {
  it('downgrades every constraint to unconfirmed PREFERRED with distinct ranks', async () => {
    const { run } = setupTools();
    const hard = buildUnavailableTime();

    const outcome = await run(ToolName.ProposeConstraints, { constraints: [hard, hard] });

    expect(outcome.block?.kind).toBe(AssistantBlockKind.ConstraintProposal);
    const constraints =
      outcome.block?.kind === AssistantBlockKind.ConstraintProposal
        ? outcome.block.constraints
        : [];
    expect(constraints.map((proposed) => proposed.constraint.strength)).toEqual([
      ConstraintStrength.Preferred,
      ConstraintStrength.Preferred,
    ]);
    expect(constraints.map((proposed) => proposed.constraint.priorityRank)).toEqual([1, 2]);
    expect(constraints.map((proposed) => proposed.confirmed)).toEqual([false, false]);
  });

  it('fails when the downgraded set breaks the one-credit-range rule', async () => {
    const { run } = setupTools();
    const hardRange = {
      kind: 'CREDIT_RANGE',
      strength: 'HARD',
      priorityRank: null,
      minCreditsHundredths: 1200,
      maxCreditsHundredths: null,
    };
    const preferredRange = {
      kind: 'CREDIT_RANGE',
      strength: 'PREFERRED',
      priorityRank: 1,
      minCreditsHundredths: null,
      maxCreditsHundredths: 1500,
    };

    const outcome = await run(ToolName.ProposeConstraints, {
      constraints: [hardRange, preferredRange],
    });

    expect(outcome.errorCode).toBe('INVALID_ARGUMENTS');
    expect(outcome.block).toBeNull();
  });

  it('refuses an empty or oversized list without a service call', async () => {
    const { run } = setupTools();

    expect((await run(ToolName.ProposeConstraints, { constraints: [] })).errorCode).toBe(
      'INVALID_ARGUMENTS',
    );
    const many = Array.from({ length: MAX_SCHEDULE_CONSTRAINTS + 1 }, () => buildUnavailableTime());
    expect((await run(ToolName.ProposeConstraints, { constraints: many })).errorCode).toBe(
      'INVALID_ARGUMENTS',
    );
  });
});

describe('request_plan', () => {
  it('uses only the form inputs and the session student', async () => {
    const { run, findOptions } = setupTools();

    const outcome = await run(ToolName.RequestPlan, {}, { plannerInputs: scheduleRequest() });

    expect(findOptions).toHaveBeenCalledOnce();
    expect(findOptions.mock.calls[0]?.[1].studentId).toBe(ownStudent.id);
    expect(outcome.block?.kind).toBe(AssistantBlockKind.ScheduleOptions);
    expect(outcome.projection).toMatchObject({ outcome: 'OPTIONS_FOUND', optionCount: 1 });
  });

  it('gives the planner-input notice when the form is empty or incomplete', async () => {
    const { run, findOptions } = setupTools();
    const incomplete = { ...scheduleRequest(), courseIds: [] };

    for (const plannerInputs of [undefined, incomplete]) {
      const outcome = await run(ToolName.RequestPlan, {}, { plannerInputs });
      expect(outcome.notice).toMatchObject({ code: NoticeCode.PlannerInputNeeded });
      expect(outcome.block).toBeNull();
      expect(outcome.errorCode).toBeNull();
    }
    expect(findOptions).not.toHaveBeenCalled();
  });

  it('refuses model-supplied arguments', async () => {
    const { run, findOptions } = setupTools();

    const outcome = await run(
      ToolName.RequestPlan,
      { courseIds: ['x'] },
      { plannerInputs: scheduleRequest() },
    );

    expect(outcome.errorCode).toBe('INVALID_ARGUMENTS');
    expect(findOptions).not.toHaveBeenCalled();
  });

  it('turns a missing section snapshot into a SOURCE_UNAVAILABLE notice', async () => {
    const { run, findOptions } = setupTools();
    findOptions.mockRejectedValueOnce(new SourceUnavailableError());

    const outcome = await run(ToolName.RequestPlan, {}, { plannerInputs: scheduleRequest() });

    expect(outcome.errorCode).toBe(ErrorCode.SourceUnavailable);
    expect(outcome.notice).toMatchObject({ code: NoticeCode.SourceUnavailable });
  });
});

describe('get_validation_evidence', () => {
  it("returns the latest revision of the student's own plan", async () => {
    const { run } = setupTools();

    const outcome = await run(ToolName.GetValidationEvidence, { planId: ownPlan.id });

    expect(outcome.block?.kind).toBe(AssistantBlockKind.PlanEvidence);
    expect(outcome.projection).toMatchObject({ revision: 1, freshness: 'CURRENT' });
  });

  it('passes a STALE revision through as STALE with its reason count', async () => {
    const { run, getRevision } = setupTools();
    getRevision.mockResolvedValueOnce(
      buildPlanRevisionView({
        planId: ownPlan.id,
        freshness: buildPlanFreshnessView({
          state: PlanFreshness.Stale,
          reasons: [PlanStaleReason.AuditSuperseded, PlanStaleReason.RulesetChanged],
        }),
      }),
    );

    const outcome = await run(ToolName.GetValidationEvidence, { planId: ownPlan.id, revision: 1 });

    expect(outcome.projection).toMatchObject({ freshness: 'STALE', staleReasonCount: 2 });
  });

  it('returns a named revision', async () => {
    const { run, getRevision } = setupTools();

    const outcome = await run(ToolName.GetValidationEvidence, { planId: ownPlan.id, revision: 1 });

    expect(outcome.errorCode).toBeNull();
    expect(getRevision).toHaveBeenCalledOnce();
  });

  it("gives NOT_FOUND for another student's plan", async () => {
    const outcome = await setupTools().run(ToolName.GetValidationEvidence, { planId: otherPlanId });

    expect(outcome.errorCode).toBe(ErrorCode.NotFound);
    expect(outcome.block).toBeNull();
  });

  it('gives NOT_FOUND for a missing revision', async () => {
    const outcome = await setupTools().run(ToolName.GetValidationEvidence, {
      planId: ownPlan.id,
      revision: 7,
    });

    expect(outcome.errorCode).toBe(ErrorCode.NotFound);
  });
});
