/**
 * @file Pure parts of the conversation tools: the outcome shape, the minimized projections the
 * model sees, and block assembly. Nothing here reads a clock, a store, or a service.
 * @module @caa/api/modules/conversation-tools/conversation-tools.logic
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-08
 * @requirement FR-10
 * @requirement FR-14
 * @requirement FR-16
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (section 4, Amendment 1)
 */
import {
  type AcademicSummaryResponse,
  type AssistantBlock,
  type PlanRevisionView,
  type PolicySearchResponse,
  type ProposedConstraint,
  type ScheduleOptionsResponse,
} from '@caa/api-contract';
import type { NoticeCode } from '@caa/domain';
import {
  AssistantBlockKind,
  CaseReason,
  ConstraintStrength,
  type DiscrepancySubject,
  type ErrorCode,
  type PlanId,
  type ScheduleConstraint,
} from '@caa/domain';

/** A JSON-serializable value: the shape of a minimized tool projection. */
export type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/** Code for arguments that fail the tool's schema or its cross-field rules. */
export const INVALID_ARGUMENTS = 'INVALID_ARGUMENTS';

/** Code for a tool name the catalog doesn't have. */
export const UNKNOWN_TOOL = 'UNKNOWN_TOOL';

/** Why a tool produced no result: a service error code or one of the tool layer's own. */
export type ToolErrorCode = ErrorCode | typeof INVALID_ARGUMENTS | typeof UNKNOWN_TOOL;

/** Template ID of the notice shown when a tool fails. */
export const TOOL_FAILED_TEMPLATE_ID = 'notice.tool-failed';

/** Template ID of the notice shown when the planner form can't be used. */
export const PLANNER_INPUT_TEMPLATE_ID = 'notice.planner-input-needed';

/** The queue every drafted case goes to. */
export const CASE_QUEUE_LABEL = 'advisors assigned to you';

/** What one tool call produces. Block and notice come from services and templates, never the model. */
export interface ToolOutcome {
  /** The minimized result for the model, with no names, emails, IDs, grades, or notes. */
  readonly projection: JsonValue;
  /** The projection wrapped as untrusted data, ready to send as the tool result. */
  readonly modelText: string;
  /** The verified view the student sees, or `null` when the tool produced none. */
  readonly block: AssistantBlock | null;
  /** A fixed-text notice the student sees instead of or beside a block, or `null`. */
  readonly notice: AssistantBlock | null;
  /** The failure code, or `null` on success. */
  readonly errorCode: ToolErrorCode | null;
}

/** The parts of an outcome a tool decides; the service adds the wrapped text. */
export type ToolResult = Omit<ToolOutcome, 'modelText'>;

/**
 * Builds a notice block from a fixed template.
 *
 * @param code - Which notice.
 * @param template - The template's ID, version, and fixed text.
 * @returns A notice block.
 */
export function buildNotice(code: NoticeCode, template: NoticeTemplate): AssistantBlock {
  return {
    kind: AssistantBlockKind.Notice,
    code,
    templateId: template.id,
    templateVersion: template.version,
    text: template.text,
  };
}

/** Identity, version and fixed text of a notice template. */
export interface NoticeTemplate {
  readonly id: string;
  readonly version: string;
  readonly text: string;
}

/**
 * Builds the result of a tool that failed.
 *
 * @param errorCode - Why it failed.
 * @param notice - The notice for the student, or `null` when the student should not see it.
 * @returns A result with no block.
 */
export function failedResult(errorCode: ToolErrorCode, notice: AssistantBlock | null): ToolResult {
  return { projection: { error: errorCode }, block: null, notice, errorCode };
}

/**
 * Counts values by key, in key order so the projection is stable.
 *
 * @param keys - One key per item.
 * @returns A count for each distinct key.
 */
function countBy(keys: readonly string[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const key of [...keys].sort()) counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}

/**
 * Minimizes the academic summary: whether an audit exists, its verdict states, and counts of
 * requirements by state. No names, IDs, labels, or credits.
 *
 * @param summary - The verified summary.
 * @returns The model projection.
 */
export function projectAcademicSummary(summary: AcademicSummaryResponse): JsonValue {
  return {
    auditAvailable: summary.audit !== null,
    auditReflectsRecord: summary.auditReflectsRecord?.state ?? null,
    requirementCount: summary.requirements.length,
    requirementsByState: countBy(summary.requirements.map((requirement) => requirement.state)),
  };
}

/**
 * Minimizes policy results to the quotable text of each hit. Policy documents are institutional
 * text, not student data; document keys are left out.
 *
 * @param results - The search response.
 * @returns The model projection.
 */
export function projectPolicyResults(results: PolicySearchResponse): JsonValue {
  return {
    hitCount: results.hits.length,
    hits: results.hits.map((hit) => ({
      title: hit.title,
      topic: hit.topic,
      excerpt: hit.excerpt,
      conflict: hit.conflict,
    })),
  };
}

/**
 * Minimizes proposed constraints to a count.
 *
 * @param proposed - The proposals.
 * @returns The model projection.
 */
export function projectConstraintProposal(proposed: readonly ProposedConstraint[]): JsonValue {
  return {
    proposedCount: proposed.length,
    strength: ConstraintStrength.Preferred,
    confirmed: false,
  };
}

/**
 * Minimizes schedule options to the outcome and counts.
 *
 * @param result - The schedule options response.
 * @returns The model projection.
 */
export function projectScheduleOptions(result: ScheduleOptionsResponse): JsonValue {
  return {
    outcome: result.outcome,
    searchComplete: result.searchComplete,
    optionCount: result.options.length,
    hasConflictSet: result.conflictSet !== null,
    limitationCount: result.limitations.length,
  };
}

/**
 * Minimizes plan evidence to the revision number, outcome, and freshness.
 *
 * @param plan - The revision view.
 * @returns The model projection.
 */
export function projectPlanEvidence(plan: PlanRevisionView): JsonValue {
  return {
    revision: plan.revision,
    outcome: plan.result?.outcome ?? null,
    resultUnavailable: plan.resultUnavailable,
    freshness: plan.freshness.state,
    staleReasonCount: plan.freshness.reasons.length,
  };
}

/**
 * Minimizes a case preview to its reason and whether it names a plan.
 *
 * @param reason - The case reason.
 * @param hasPlan - Whether a plan revision is attached.
 * @returns The model projection.
 */
export function projectCasePreview(reason: CaseReason, hasPlan: boolean): JsonValue {
  return { reason, hasPlan, submitted: false };
}

/**
 * Turns the model's constraints into unconfirmed PREFERRED proposals.
 *
 * @param constraints - The validated constraints the model named.
 * @returns One proposal per constraint, ranked in the order given.
 */
export function toProposals(constraints: readonly ScheduleConstraint[]): ProposedConstraint[] {
  // SAFETY: every proposal is PREFERRED and unconfirmed; a hard rule exists only when the
  // student chooses it in the planner form (ADR-0015 section 4, FR-08).
  return constraints.map((constraint, index) => ({
    constraint: { ...constraint, strength: ConstraintStrength.Preferred, priorityRank: index + 1 },
    confirmed: false as const,
  }));
}

/** The plan a case preview names, or `null` for a source discrepancy without one. */
export interface PreviewPlan {
  readonly planId: PlanId;
  readonly revision: number;
}

/**
 * Checks the cross-field rules of a case draft's arguments.
 *
 * @param reason - The case reason.
 * @param planId - The plan the model named, if any.
 * @param subject - The discrepancy subject the model named, if any.
 * @returns True when the combination can form a case preview.
 */
export function isValidCaseDraft(
  reason: CaseReason,
  planId: PlanId | undefined,
  subject: DiscrepancySubject | undefined,
): boolean {
  const isDiscrepancy = reason === CaseReason.SourceDiscrepancy;
  // SAFETY: a subject belongs to a discrepancy only, and any other reason needs a plan to review.
  return isDiscrepancy ? subject !== undefined : subject === undefined && planId !== undefined;
}

/**
 * Builds the case preview block. The note is always empty: the model writes none.
 *
 * @param reason - The case reason.
 * @param plan - The plan revision to freeze, or `null`.
 * @param subject - The disputed subject for a discrepancy, or `undefined`.
 * @returns A preview block that creates nothing.
 */
export function buildCasePreviewBlock(
  reason: CaseReason,
  plan: PreviewPlan | null,
  subject: DiscrepancySubject | undefined,
): AssistantBlock {
  return {
    kind: AssistantBlockKind.CasePreview,
    reason,
    planId: plan?.planId ?? null,
    planRevision: plan?.revision ?? null,
    discrepancySubject: subject ?? null,
    suggestedNote: '',
    queueLabel: CASE_QUEUE_LABEL,
  };
}
