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

import type { ConversationTurnView } from '@caa/api-contract';
import type { AssistantBlockRef } from '@caa/domain';
import { AssistantBlockKind } from '@caa/domain';

import { Timestamp } from '@/shared/components/timestamp';

import {
  HELP_LINK_TEXT,
  STORED_NOTICE_UNAVAILABLE,
  STORED_REFERRAL_UNAVAILABLE,
} from '../utils/conversation-wording';
import type { StudentLinks } from '../utils/student-links';
import { BlockBody } from './block-body';

/** The re-rendered template blocks of a stored assistant turn. */
type TemplateBlocks = NonNullable<
  Extract<ConversationTurnView, { role: 'ASSISTANT' }>['templateBlocks']
>;

/** Props for {@link StoredBlockRefs}. */
export interface StoredBlockRefsProps {
  readonly refs: readonly AssistantBlockRef[];
  readonly links: StudentLinks;
  /** Server re-rendered referral and notice blocks, keyed by `refIndex`; absent on older turns. */
  readonly templateBlocks?: TemplateBlocks | undefined;
}

type TemplateBlock = NonNullable<TemplateBlocks>[number]['block'];
type Rendered = ReadonlyMap<number, TemplateBlock>;

/**
 * Renders a stored referral or notice: the block the server re-rendered from its fixed template
 * through the component a live turn uses, or the "unavailable" notice with a link to Help and
 * cases when there is no entry for this ref.
 *
 * @param line - The REFERRAL or NOTICE reference, its React key and its re-rendered block, if any.
 * @param links - The student's screen links.
 * @returns The list entry.
 */
function templateLine(
  line: {
    ref: AssistantBlockRef;
    key: string;
    block: TemplateBlock | undefined;
  },
  links: StudentLinks,
): ReactElement {
  const { ref, key, block } = line;
  if (block?.kind === ref.kind) {
    return (
      <li key={key} className="chat-block">
        <BlockBody block={block} links={links} />
      </li>
    );
  }
  const isReferral = ref.kind === AssistantBlockKind.Referral;
  return (
    <li key={key} role="note" className={`notice notice--${isReferral ? 'problem' : 'caution'}`}>
      {isReferral ? STORED_REFERRAL_UNAVAILABLE : STORED_NOTICE_UNAVAILABLE}{' '}
      <Link href={links.help}>{HELP_LINK_TEXT}</Link>.
    </li>
  );
}

/**
 * Renders one line per reference. Screen results point to their screen. A stored referral or
 * notice shows its re-rendered block when the server sent one. Academic results never get a
 * block. Proposals and case previews have no past result to point to and are skipped.
 *
 * @param props - The references, the links and the re-rendered template blocks.
 * @returns The list, or null when there is nothing to show.
 */
export function StoredBlockRefs({
  refs,
  links,
  templateBlocks,
}: StoredBlockRefsProps): ReactElement | null {
  const rendered: Rendered = new Map(
    (templateBlocks ?? []).map((entry) => [entry.refIndex, entry.block]),
  );
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
      case AssistantBlockKind.Notice:
        return [templateLine({ ref, key, block: rendered.get(index) }, links)];
      default:
        return [];
    }
  });
  if (lines.length === 0) {
    return null;
  }
  return <ul className="chat-refs">{lines}</ul>;
}
