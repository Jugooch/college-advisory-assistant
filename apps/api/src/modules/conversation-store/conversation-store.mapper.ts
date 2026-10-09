/**
 * @file Re-renders stored referral and notice references from the assistant's templates, in the
 * shape the transcript contract accepts.
 * @module @caa/api/modules/conversation-store/conversation-store.mapper
 * @requirement FR-10
 * @requirement AC50
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md (Amendment 3)
 */
import { renderStoredTemplateBlock } from '@caa/assistant';
import { AssistantBlockKind } from '@caa/domain';

import type { TemplateBlockRenderer } from './conversation-store.logic';

/**
 * Re-renders one stored template reference with no model call.
 *
 * @param ref - The stored referral or notice reference.
 * @param asOf - The stored turn's time, recorded on a referral (a replay has no live policy hit).
 * @returns The block, or null when the template id is unknown or its version is not current.
 */
export const renderTemplateBlock: TemplateBlockRenderer = (ref, asOf) => {
  const block = renderStoredTemplateBlock(ref);
  if (block === null) return null;
  return block.kind === AssistantBlockKind.Referral ? { ...block, policy: null, asOf } : block;
};
