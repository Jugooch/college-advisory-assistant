/**
 * @file The search_approved_policy tool: search the approved policy corpus.
 * @module @caa/assistant/tools/search-approved-policy
 * @requirement FR-10
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

import { PolicyTopicSchema } from '@caa/domain';

import { defineTool, ToolName } from './tool-catalog';

/** Shortest search query, in characters. */
export const POLICY_QUERY_MIN_LENGTH = 1;

/** Longest search query, in characters. */
export const POLICY_QUERY_MAX_LENGTH = 200;

/** Schema for the tool's arguments. Tenant and audience are bound by the orchestrator, not asked of the model. */
export const SearchApprovedPolicyArgsSchema = z.strictObject({
  query: z.string().min(POLICY_QUERY_MIN_LENGTH).max(POLICY_QUERY_MAX_LENGTH),
  topic: PolicyTopicSchema.optional(),
});

/** The tool definition. */
export const SEARCH_APPROVED_POLICY_TOOL = defineTool(
  ToolName.SearchApprovedPolicy,
  'Search approved college policy documents for a short query, optionally within one topic. Returns titles and excerpts to quote, not rules to restate from memory.',
  SearchApprovedPolicyArgsSchema,
);
