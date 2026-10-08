/**
 * @file The academic-summary block in chat: the audit freshness and requirement overview,
 * rendered from the block's structured fields exactly as the summary screen shows them.
 * @module @caa/web/features/conversation/components/academic-summary-block
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { ReactElement } from 'react';

import type { AssistantBlock } from '@caa/api-contract';

import { AuditFreshness } from '@/shared/components/audit-freshness';
import { RequirementOverview } from '@/shared/components/requirement-overview';

/** Props for {@link AcademicSummaryBlock}. */
export interface AcademicSummaryBlockProps {
  readonly block: Extract<AssistantBlock, { kind: 'ACADEMIC_SUMMARY' }>;
}

/**
 * Renders the summary's audit freshness and requirement overview.
 *
 * @param props - The block.
 * @returns The summary card.
 */
export function AcademicSummaryBlock({ block }: AcademicSummaryBlockProps): ReactElement {
  return (
    <section className="chat-card" aria-label="Academic summary">
      <AuditFreshness summary={block.summary} />
      <RequirementOverview summary={block.summary} />
    </section>
  );
}
