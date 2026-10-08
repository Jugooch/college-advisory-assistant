/**
 * @file The saved-plan evidence block in chat: a plan revision with its freshness and result,
 * rendered from the block's structured fields. A saved plan is never called registered.
 * @module @caa/web/features/conversation/components/plan-evidence-block
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

import type { AssistantBlock } from '@caa/api-contract';

import { FreshnessBanner } from '@/shared/components/freshness-banner';
import { ResultSection } from '@/shared/components/result-section';
import { ScheduleResults } from '@/shared/components/schedule-results';
import { Timestamp } from '@/shared/components/timestamp';
import { PLAN_BOUNDARY_NOTE } from '@/shared/utils/plan-detail-wording';

import type { StudentLinks } from '../utils/student-links';

/** Props for {@link PlanEvidenceBlock}. */
export interface PlanEvidenceBlockProps {
  readonly block: Extract<AssistantBlock, { kind: 'PLAN_EVIDENCE' }>;
  readonly links: StudentLinks;
}

/**
 * Renders a saved plan revision with its freshness. A saved plan is never called registered.
 *
 * @param props - The block and the links.
 * @returns The evidence card.
 */
export function PlanEvidenceBlock({ block, links }: PlanEvidenceBlockProps): ReactElement {
  const { plan } = block;
  const isHistory = plan.freshness.state !== 'CURRENT';
  return (
    <section className="chat-card" aria-label={`Saved plan, revision ${String(plan.revision)}`}>
      <p>
        Revision {plan.revision}, saved <Timestamp iso={plan.createdAt} />
      </p>
      <p>{PLAN_BOUNDARY_NOTE}</p>
      <FreshnessBanner freshness={plan.freshness} />
      <ResultSection
        revision={plan}
        isHistory={isHistory}
        renderResult={(result, heading) => (
          <ScheduleResults
            result={result}
            courses={new Map()}
            heading={heading}
            isHeadingFocused={false}
          />
        )}
      />
      <p>
        <Link href={`/my-plans/${plan.planId}?studentId=${links.studentId}`}>
          Open this plan in My plans
        </Link>
      </p>
    </section>
  );
}
