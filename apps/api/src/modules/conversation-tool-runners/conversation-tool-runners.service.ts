/**
 * @file The body of each of the assistant's six tools. Each runner reads through an existing
 * service for the session's student and returns a minimized projection plus the verified block.
 * Every dependency is a read; no case, plan, or institutional write is reachable from here.
 * @module @caa/api/modules/conversation-tool-runners/conversation-tool-runners.service
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-08
 * @requirement FR-10
 * @requirement FR-14
 * @requirement FR-16
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (section 4, Amendment 1)
 */
import type { z } from 'zod';

import { type ScheduleOptionsRequest, ScheduleOptionsRequestSchema } from '@caa/api-contract';
import {
  DraftCaseContextArgsSchema,
  GetValidationEvidenceArgsSchema,
  ProposeConstraintsArgsSchema,
  renderNotice,
  SearchApprovedPolicyArgsSchema,
  TEMPLATE_VERSION,
  ToolName,
} from '@caa/assistant';
import {
  type Actor,
  AssistantBlockKind,
  NoticeCode,
  ScheduleConstraintSetSchema,
  type StudentId,
} from '@caa/domain';

import type { RequestContext } from '../../shared/request-context';
import { toAcademicSummaryResponse } from '../academic-summary/academic-summary.mapper';
import type { AcademicSummaryService } from '../academic-summary/academic-summary.service';
import {
  buildCasePreviewBlock,
  isValidCaseDraft,
  isValidCaseShape,
  pickCurrentPlan,
  type PreviewPlan,
  projectCasePreview,
  reasonNeedsPlan,
} from '../conversation-tool-case-preview/conversation-tool-case-preview.logic';
import {
  projectAcademicSummary,
  projectConstraintProposal,
  projectPlanEvidence,
  projectPolicyResults,
  projectScheduleOptions,
} from '../conversation-tool-projections/conversation-tool-projections.logic';
import { toProposals } from '../conversation-tool-proposals/conversation-tool-proposals.logic';
import {
  buildNotice,
  failedResult,
  INVALID_ARGUMENTS,
  PLANNER_INPUT_TEMPLATE_ID,
  succeededResult,
  type ToolResult,
} from '../conversation-tools/conversation-tools.logic';
import type { PlanViewsService } from '../plan-views/plan-views.service';
import type { PolicySearchService } from '../policy-search/policy-search.service';
import type { ScheduleOptionsService } from '../schedule-options/schedule-options.service';

/** The read services the tools call. */
export interface ToolRunnersDependencies {
  readonly academicSummary: Pick<AcademicSummaryService, 'getAcademicSummary'>;
  readonly policySearch: Pick<PolicySearchService, 'search'>;
  readonly scheduleOptions: Pick<ScheduleOptionsService, 'findOptions'>;
  readonly planViews: Pick<PlanViewsService, 'getPlan' | 'getRevision' | 'listPlans'>;
}

/** What a runner gets once access is settled. The student is the session's, never the model's. */
export interface ToolRun {
  readonly actor: Actor;
  readonly studentId: StudentId;
  /** The planner form's confirmed state, if any. */
  readonly plannerInputs: ScheduleOptionsRequest | undefined;
  /** The model's arguments; each runner parses them with its own tool's schema. */
  readonly args: unknown;
  readonly context: RequestContext;
}

/** Runs one tool. */
export type ToolRunner = (run: ToolRun) => Promise<ToolResult>;

/** A tool run whose arguments are already parsed. */
type ParsedToolRun<Args> = Omit<ToolRun, 'args'> & { readonly args: Args };

/**
 * Builds a runner that parses its arguments with the tool's schema, so the body's argument type
 * is the schema's output and cannot drift from it.
 *
 * @param schema - The tool's argument schema.
 * @param body - The runner body, given the parsed arguments.
 * @returns A runner that answers INVALID_ARGUMENTS when the arguments do not parse.
 */
function withArgs<Schema extends z.ZodType>(
  schema: Schema,
  body: (run: ParsedToolRun<z.output<Schema>>) => Promise<ToolResult>,
): ToolRunner {
  return (run) => {
    const parsed = schema.safeParse(run.args);
    if (!parsed.success) return Promise.resolve(failedResult(INVALID_ARGUMENTS, null));
    return body({ ...run, args: parsed.data });
  };
}
/**
 * Builds the fixed planner-input-needed result: no block, and the template notice.
 *
 * @returns The result.
 */
function plannerInputNeeded(): ToolResult {
  const text = renderNotice(NoticeCode.PlannerInputNeeded);
  return {
    projection: { plannerInputNeeded: true },
    block: null,
    notice: buildNotice(NoticeCode.PlannerInputNeeded, {
      id: PLANNER_INPUT_TEMPLATE_ID,
      version: TEMPLATE_VERSION,
      text,
    }),
    errorCode: null,
  };
}

/**
 * Builds the runner for `get_academic_summary`.
 *
 * @param deps - The summary service.
 * @returns The runner.
 */
function academicSummaryRunner(deps: ToolRunnersDependencies): ToolRunner {
  return async ({ actor, studentId, context }) => {
    const summary = toAcademicSummaryResponse(
      await deps.academicSummary.getAcademicSummary(actor, studentId, context),
    );
    return succeededResult(projectAcademicSummary(summary), {
      kind: AssistantBlockKind.AcademicSummary,
      summary,
    });
  };
}

/**
 * Builds the runner for `search_approved_policy`.
 *
 * @param deps - The policy search service.
 * @returns The runner.
 */
function policyRunner(deps: ToolRunnersDependencies): ToolRunner {
  return withArgs(SearchApprovedPolicyArgsSchema, async ({ actor, args, context }) => {
    const { query, topic } = args;
    const results = await deps.policySearch.search(actor, { q: query, topic }, context);
    return succeededResult(projectPolicyResults(results), {
      kind: AssistantBlockKind.PolicyResults,
      results,
    });
  });
}

/**
 * Builds the runner for `propose_constraints`. It calls no service: it downgrades the model's
 * constraints to unconfirmed PREFERRED proposals.
 *
 * @returns The runner.
 */
function proposeConstraintsRunner(): ToolRunner {
  return withArgs(ProposeConstraintsArgsSchema, ({ args }) => {
    const proposed = toProposals(args.constraints);
    // SAFETY: the set rules (one credit range per strength, distinct ranks) are not checked
    // per item, and downgrading every item to PREFERRED can break them. A set the block
    // contract would reject is a failure, never a block the student's chip could not confirm.
    const set = ScheduleConstraintSetSchema.safeParse(proposed.map((item) => item.constraint));
    if (!set.success) return Promise.resolve(failedResult(INVALID_ARGUMENTS, null));
    return Promise.resolve(
      succeededResult(projectConstraintProposal(proposed), {
        kind: AssistantBlockKind.ConstraintProposal,
        constraints: proposed,
      }),
    );
  });
}

/**
 * Builds the runner for `request_plan`.
 *
 * @param deps - The schedule options service.
 * @returns The runner.
 */
function requestPlanRunner(deps: ToolRunnersDependencies): ToolRunner {
  return async ({ actor, studentId, plannerInputs, context }) => {
    // SECURITY: only the form's confirmed state is used; the model supplies no inputs.
    const inputs = ScheduleOptionsRequestSchema.safeParse(plannerInputs);
    if (!inputs.success) return plannerInputNeeded();
    const result = await deps.scheduleOptions.findOptions(
      actor,
      { ...inputs.data, studentId },
      context,
    );
    return succeededResult(projectScheduleOptions(result), {
      kind: AssistantBlockKind.ScheduleOptions,
      result,
    });
  };
}

/**
 * Builds the runner for `get_validation_evidence`.
 *
 * @param deps - The plan views service.
 * @returns The runner.
 */
function evidenceRunner(deps: ToolRunnersDependencies): ToolRunner {
  return withArgs(GetValidationEvidenceArgsSchema, async ({ actor, studentId, args, context }) => {
    const { planId, revision } = args;
    // SECURITY: the plan is read under the session's student, so another student's plan is
    // NOT_FOUND.
    const plan =
      revision === undefined
        ? (await deps.planViews.getPlan(actor, { studentId, planId }, context)).latest
        : await deps.planViews.getRevision(actor, { studentId, planId, revision }, context);
    return succeededResult(projectPlanEvidence(plan), {
      kind: AssistantBlockKind.PlanEvidence,
      plan,
    });
  });
}

/**
 * Builds the runner for `draft_case_context`: a preview only.
 *
 * @param deps - The plan views service, to find the revision a preview would freeze.
 * @returns The runner.
 */
function draftCaseRunner(deps: ToolRunnersDependencies): ToolRunner {
  return withArgs(
    DraftCaseContextArgsSchema,
    async ({ actor, studentId, plannerInputs, args, context }) => {
      const { reason, planId, discrepancySubject } = args;
      if (planId === undefined && !isValidCaseShape(reason, discrepancySubject)) {
        return failedResult(INVALID_ARGUMENTS, null);
      }
      let plan: PreviewPlan | null = null;
      if (planId !== undefined) {
        // SECURITY: the plan is read under the session's student; another student's is NOT_FOUND.
        const view = await deps.planViews.getPlan(actor, { studentId, planId }, context);
        plan = { planId, revision: view.latest.revision };
      } else if (reasonNeedsPlan(reason)) {
        // SECURITY: the model never holds a plan id, so the session student's own saved plan is
        // resolved here, under the session's tenant and student.
        const { plans } = await deps.planViews.listPlans(actor, studentId, context);
        plan = pickCurrentPlan(plans, plannerInputs?.termId);
        if (plan === null) return plannerInputNeeded();
      }
      if (!isValidCaseDraft(reason, plan?.planId, discrepancySubject)) {
        return failedResult(INVALID_ARGUMENTS, null);
      }
      // SAFETY: a preview only. Nothing is created; the student submits through the case flow.
      return succeededResult(
        projectCasePreview(reason, plan !== null),
        buildCasePreviewBlock(reason, plan, discrepancySubject),
      );
    },
  );
}

/** One runner per tool, each reading through an existing service. */
export type ConversationToolRunnersService = Readonly<Record<ToolName, ToolRunner>>;

/**
 * Builds every tool's runner.
 *
 * @param deps - The read services.
 * @returns One runner per tool.
 */
export function createConversationToolRunnersService(
  deps: ToolRunnersDependencies,
): ConversationToolRunnersService {
  return {
    [ToolName.GetAcademicSummary]: academicSummaryRunner(deps),
    [ToolName.SearchApprovedPolicy]: policyRunner(deps),
    [ToolName.ProposeConstraints]: proposeConstraintsRunner(),
    [ToolName.RequestPlan]: requestPlanRunner(deps),
    [ToolName.GetValidationEvidence]: evidenceRunner(deps),
    [ToolName.DraftCaseContext]: draftCaseRunner(deps),
  };
}
