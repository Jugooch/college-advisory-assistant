/**
 * @file The blocks of one assistant turn. Policy results, notices and referrals render their
 * structured fields; result-bearing blocks point to the screen that shows the verified result.
 * @module @caa/web/features/conversation/components/assistant-blocks
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

import type { AssistantBlock } from '@caa/api-contract';
import { AssistantBlockKind } from '@caa/domain';

import { PolicyHitList } from '@/shared/components/policy-hit-list';
import { Timestamp } from '@/shared/components/timestamp';

import { type StudentLinks, studentLinks } from '../utils/student-links';

/** Props for {@link AssistantBlocks}. */
export interface AssistantBlocksProps {
  /** Blocks exactly as the API returned them. */
  readonly blocks: readonly AssistantBlock[];
  readonly studentId: string;
}

/**
 * Renders each block by kind. Nothing here recomputes a check or upgrades a state.
 *
 * @param props - The blocks and the student, for links.
 * @returns The list of blocks, or nothing when there are none.
 */
export function AssistantBlocks({ blocks, studentId }: AssistantBlocksProps): ReactElement | null {
  if (blocks.length === 0) {
    return null;
  }
  const links = studentLinks(studentId);
  return (
    <ul className="chat-blocks">
      {blocks.map((block, index) => (
        <li key={`${block.kind}-${String(index)}`} className="chat-block">
          <BlockBody block={block} links={links} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Renders one block: structured content for notices, referrals and policy results, and a pointer
 * to the verified screen for everything else.
 *
 * @param props - The block and the links.
 * @returns The block's content.
 */
function BlockBody({
  block,
  links,
}: {
  readonly block: AssistantBlock;
  readonly links: StudentLinks;
}): ReactElement {
  switch (block.kind) {
    case AssistantBlockKind.Notice:
      return (
        <p role="note" className="notice notice--caution">
          {block.text}
        </p>
      );
    case AssistantBlockKind.Referral:
      return (
        <div role="note" className="notice notice--problem">
          <p>{block.text}</p>
          {block.policy === null ? null : <PolicyHitList hits={[block.policy]} headingLevel={3} />}
          <p>
            Checked <Timestamp iso={block.asOf} />.
          </p>
        </div>
      );
    case AssistantBlockKind.PolicyResults:
      return block.results.hits.length === 0 ? (
        <p>No approved policy matched. Ask your advising office.</p>
      ) : (
        <PolicyHitList hits={block.results.hits} headingLevel={3} />
      );
    default:
      return <ResultPointer block={block} links={links} />;
  }
}

/**
 * Points to the screen that shows a verified result, instead of rendering one here.
 *
 * @param props - The block and the links.
 * @returns The pointer text with its link.
 */
function ResultPointer({
  block,
  links,
}: {
  readonly block: AssistantBlock;
  readonly links: StudentLinks;
}): ReactElement {
  switch (block.kind) {
    case AssistantBlockKind.ScheduleOptions:
      return (
        <p>
          A schedule search result is ready.{' '}
          <Link href={links.planner}>Open it on the planner</Link>, where every check is shown.
        </p>
      );
    case AssistantBlockKind.PlanEvidence:
      return (
        <p>
          A saved plan is relevant here. <Link href={links.plans}>Open My plans</Link>. A saved plan
          is not a registration.
        </p>
      );
    case AssistantBlockKind.AcademicSummary:
      return (
        <p>
          Your academic summary is relevant here. <Link href={links.overview}>Open Overview</Link>.
        </p>
      );
    default:
      return (
        <p>
          This suggestion isn’t available in chat yet. Use{' '}
          <Link href={links.planner}>the form</Link> or{' '}
          <Link href={links.help}>Help and cases</Link>.
        </p>
      );
  }
}
