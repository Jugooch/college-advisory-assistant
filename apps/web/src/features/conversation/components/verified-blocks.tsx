/**
 * @file The verified result blocks in chat: schedule options, saved-plan evidence and the
 * academic summary. Each renders the shared card from the block's structured fields, with the
 * same check wording and freshness as on its own screen. Nothing is recomputed here.
 * @module @caa/web/features/conversation/components/verified-blocks
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

import type { AssistantBlock } from '@caa/api-contract';

import { AuditFreshness } from '@/shared/components/audit-freshness';
import { FreshnessBanner } from '@/shared/components/freshness-banner';
import { RequirementOverview } from '@/shared/components/requirement-overview';
import { ResultSection } from '@/shared/components/result-section';
import { ScheduleResults } from '@/shared/components/schedule-results';
import { Timestamp } from '@/shared/components/timestamp';
import { PLAN_BOUNDARY_NOTE } from '@/shared/utils/plan-detail-wording';

import type { StudentLinks } from '../utils/student-links';

/** Props for {@link ScheduleOptionsBlock}. */
export interface ScheduleOptionsBlockProps {
  readonly block: Extract<AssistantBlock, { kind: 'SCHEDULE_OPTIONS' }>;
}

/**
 * Renders the search result as the planner does.
 *
 * @param props - The block.
 * @returns The results section.
 */
export function ScheduleOptionsBlock({ block }: ScheduleOptionsBlockProps): ReactElement {
  return <ScheduleResults result={block.result} courses={new Map()} isHeadingFocused={false} />;
}

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
