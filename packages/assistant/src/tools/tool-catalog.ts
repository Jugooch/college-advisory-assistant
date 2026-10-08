/**
 * @file The only tools the deployed model may call.
 * @module @caa/assistant/tools/tool-catalog
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-08
 * @requirement FR-10
 * @requirement FR-14
 * @see docs/planning/10-ai-behavior-and-safety-contract.md
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

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

/**
 * Version of the tool names, descriptions and argument schemas. Bump it on any change to them;
 * each assistant turn records it (ADR-0015 §1, §4).
 */
export const TOOL_SCHEMA_VERSION = 'tools-2026-10-08.1';

/** A JSON Schema object handed to the model provider as a tool's input schema. */
export type ToolInputJsonSchema = Readonly<Record<string, unknown>>;

/** One tool as the assistant defines it: a strict argument schema and its provider form. */
export interface ToolDefinition<Args extends z.ZodType = z.ZodType> {
  readonly name: ToolName;
  readonly description: string;
  /** Validates the model's arguments; a failed parse is returned to the model as `INVALID_ARGUMENTS`. */
  readonly argumentsSchema: Args;
  /** The same schema as JSON Schema, for the provider. */
  readonly inputSchema: ToolInputJsonSchema;
}

/**
 * Builds a tool definition, deriving the provider JSON Schema from the argument schema so the two
 * can't drift apart.
 *
 * @param name - The tool's catalog name.
 * @param description - What the tool does, shown to the model.
 * @param argumentsSchema - A strict Zod object with no identity fields.
 * @returns The tool definition.
 */
export function defineTool<Args extends z.ZodType>(
  name: ToolName,
  description: string,
  argumentsSchema: Args,
): ToolDefinition<Args> {
  return {
    name,
    description,
    argumentsSchema,
    inputSchema: z.toJSONSchema(argumentsSchema, { target: 'draft-7' }),
  };
}
