/**
 * @file Maps the assistant package's versions and a turn's guard reasons to the metadata stored
 * with an answer.
 * @module @caa/api/modules/conversation/conversation.mapper
 * @requirement FR-01
 * @requirement FR-10
 * @requirement FR-14
 * @requirement AC44
 * @requirement AC46
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (sections 3 and 7, Amendment 1)
 */
import { PROMPT_VERSION, TEMPLATE_VERSION, TOOL_SCHEMA_VERSION } from '@caa/assistant';
import type { AssistantTurnMetadata, PolicyRevisionRef } from '@caa/domain';

/**
 * Builds the metadata stored with an assistant turn. None of it enters a plan's pinned inputs.
 *
 * @param modelId - The model asked, or `null` when none was.
 * @param reasons - Why the server chose the reply.
 * @param policyRevisions - Policy revisions the turn showed.
 * @returns The metadata.
 */
export function buildMetadata(
  modelId: string | null,
  reasons: readonly string[],
  policyRevisions: readonly PolicyRevisionRef[],
): AssistantTurnMetadata {
  return {
    modelId,
    promptVersion: PROMPT_VERSION,
    toolSchemaVersion: TOOL_SCHEMA_VERSION,
    templateVersion: TEMPLATE_VERSION,
    guardReasons: reasons,
    policyRevisions,
  };
}
