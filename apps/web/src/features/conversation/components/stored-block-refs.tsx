/**
 * @file The blocks an earlier turn showed, as references only: "shown at <time>" with a link to
 * rerun or open. A past result is never shown again, because it may be stale.
 * @module @caa/web/features/conversation/components/stored-block-refs
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

import type { AssistantBlockRef } from '@caa/domain';
import { AssistantBlockKind } from '@caa/domain';

import { Timestamp } from '@/shared/components/timestamp';

import {
  HELP_LINK_TEXT,
  STORED_NOTICE_UNAVAILABLE,
  STORED_REFERRAL_UNAVAILABLE,
} from '../utils/conversation-wording';
import type { StudentLinks } from '../utils/student-links';

/** Props for {@link StoredBlockRefs}. */
export interface StoredBlockRefsProps {
  readonly refs: readonly AssistantBlockRef[];
  readonly links: StudentLinks;
}

/**
 * Renders one line per reference. Screen results point to their screen. A stored referral or
 * notice carries only a template id and code, not its wording, so it shows the "unavailable"
 * notice with a link to Help and cases rather than vanishing. Proposals and case previews have no
 * past result to point to and are skipped.
 *
 * @param props - The references and the links.
 * @returns The list, or null when there is nothing to show.
 */
export function StoredBlockRefs({ refs, links }: StoredBlockRefsProps): ReactElement | null {
  const lines = refs.flatMap((ref, index) => {
    const key = `${ref.kind}-${String(index)}`;
    switch (ref.kind) {
      case AssistantBlockKind.ScheduleOptions:
        return [
          <li key={key}>
            Schedule search shown at <Timestamp iso={ref.shownAt} />.{' '}
            <Link href={links.planner}>Rerun it on the planner</Link>.
          </li>,
        ];
      case AssistantBlockKind.AcademicSummary:
        return [
          <li key={key}>
            Academic summary shown at <Timestamp iso={ref.shownAt} />.{' '}
            <Link href={links.overview}>Open Overview</Link>.
          </li>,
        ];
      case AssistantBlockKind.PlanEvidence:
        return [
          <li key={key}>
            Saved plan, revision {ref.revision}, shown.{' '}
            <Link href={links.plans}>Open My plans</Link>.
          </li>,
        ];
      case AssistantBlockKind.PolicyResults:
        return [
          <li key={key}>
            Policy results shown. <Link href={links.help}>Search policies again</Link>.
          </li>,
        ];
      case AssistantBlockKind.Referral:
        return [
          <li key={key} role="note" className="notice notice--problem">
            {STORED_REFERRAL_UNAVAILABLE} <Link href={links.help}>{HELP_LINK_TEXT}</Link>.
          </li>,
        ];
      case AssistantBlockKind.Notice:
        return [
          <li key={key} role="note" className="notice notice--caution">
            {STORED_NOTICE_UNAVAILABLE} <Link href={links.help}>{HELP_LINK_TEXT}</Link>.
          </li>,
        ];
      default:
        return [];
    }
  });
  if (lines.length === 0) {
    return null;
  }
  return <ul className="chat-refs">{lines}</ul>;
}
