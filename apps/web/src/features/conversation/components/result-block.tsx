/**
 * @file Renders a result or suggestion block: verified cards, constraint chips and the case
 * preview.
 * @module @caa/web/features/conversation/components/result-block
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { ReactElement } from 'react';

import type { AssistantBlock } from '@caa/api-contract';
import { AssistantBlockKind } from '@caa/domain';

import type { StudentLinks } from '../utils/student-links';
import { AcademicSummaryBlock } from './academic-summary-block';
import { CasePreviewBlock } from './case-preview-block';
import { ConstraintProposal } from './constraint-proposal';
import { PlanEvidenceBlock } from './plan-evidence-block';
import { ScheduleOptionsBlock } from './schedule-options-block';

/** Props for {@link ResultBlock}. */
export interface ResultBlockProps {
  readonly block: AssistantBlock;
  readonly links: StudentLinks;
}

/**
 * Renders a result or suggestion block.
 *
 * @param props - The block and the links.
 * @returns The block's content, or nothing for a kind with no card.
 */
export function ResultBlock({ block, links }: ResultBlockProps): ReactElement | null {
  switch (block.kind) {
    case AssistantBlockKind.ScheduleOptions:
      return <ScheduleOptionsBlock block={block} />;
    case AssistantBlockKind.PlanEvidence:
      return <PlanEvidenceBlock block={block} links={links} />;
    case AssistantBlockKind.AcademicSummary:
      return <AcademicSummaryBlock block={block} />;
    case AssistantBlockKind.ConstraintProposal:
      return <ConstraintProposal constraints={block.constraints} />;
    case AssistantBlockKind.CasePreview:
      return <CasePreviewBlock block={block} studentId={links.studentId} />;
    default:
      return null;
  }
}
