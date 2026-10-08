/**
 * @file Every tool definition, registered in catalog order.
 * @module @caa/assistant/tools/all-tools
 * @requirement FR-01
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { ModelToolDefinition } from '../ports/conversation-model.port';
import { DRAFT_CASE_CONTEXT_TOOL } from './draft-case-context.tool';
import { GET_ACADEMIC_SUMMARY_TOOL } from './get-academic-summary.tool';
import { GET_VALIDATION_EVIDENCE_TOOL } from './get-validation-evidence.tool';
import { PROPOSE_CONSTRAINTS_TOOL } from './propose-constraints.tool';
import { REQUEST_PLAN_TOOL } from './request-plan.tool';
import { SEARCH_APPROVED_POLICY_TOOL } from './search-approved-policy.tool';
import type { ToolDefinition } from './tool-catalog';

/** All six tools. Adding one needs a security review and an ADR (planning/10 §Allowed tools). */
export const ALL_TOOLS: readonly ToolDefinition[] = [
  GET_ACADEMIC_SUMMARY_TOOL,
  SEARCH_APPROVED_POLICY_TOOL,
  PROPOSE_CONSTRAINTS_TOOL,
  REQUEST_PLAN_TOOL,
  GET_VALIDATION_EVIDENCE_TOOL,
  DRAFT_CASE_CONTEXT_TOOL,
];

/** The tools in the form the model port takes. */
export const MODEL_TOOL_DEFINITIONS: readonly ModelToolDefinition[] = ALL_TOOLS.map((tool) => ({
  name: tool.name,
  description: tool.description,
  inputSchema: tool.inputSchema,
}));
