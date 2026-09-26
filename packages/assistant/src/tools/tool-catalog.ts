/**
 * @file The only tools the deployed model may call.
 * @module @caa/assistant/tools/tool-catalog
 * @see docs/planning/10-ai-behavior-and-safety-contract.md
 */

/** Names of every tool exposed to the model. Adding a tool requires a security review. */
export const ToolName = {
  GetAcademicSummary: 'get_academic_summary',
  SearchApprovedPolicy: 'search_approved_policy',
  ProposeConstraints: 'propose_constraints',
  RequestPlan: 'request_plan',
  GetValidationEvidence: 'get_validation_evidence',
  DraftCaseContext: 'draft_case_context',
} as const;

/** Union of every {@link ToolName} value. */
export type ToolName = (typeof ToolName)[keyof typeof ToolName];

/** Every tool name, in a stable order, for registration and tests. */
export const TOOL_NAMES: readonly ToolName[] = Object.values(ToolName);
