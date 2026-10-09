/**
 * @file One assistant block: structured content for notices, referrals and policy results, and a
 * verified cards for everything else.
 * @module @caa/web/features/conversation/components/block-body
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { ReactElement } from 'react';

import type { AssistantBlock } from '@caa/api-contract';
import { AssistantBlockKind } from '@caa/domain';

import { PolicyHitList } from '@/shared/components/policy-hit-list';
import { Timestamp } from '@/shared/components/timestamp';

import { CHAT_CARD_LEVEL } from '../utils/chat-heading-level';
import type { StudentLinks } from '../utils/student-links';
import { ResultBlock } from './result-block';

/** Props for {@link BlockBody}. */
export interface BlockBodyProps {
  readonly block: AssistantBlock;
  readonly links: StudentLinks;
}

/**
 * Renders one block: structured content for notices, referrals and policy results, and cards
 * to the verified screen for everything else.
 *
 * @param props - The block and the links.
 * @returns The block's content.
 */
export function BlockBody({ block, links }: BlockBodyProps): ReactElement {
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
          {block.policy === null ? null : (
            <PolicyHitList hits={[block.policy]} headingLevel={CHAT_CARD_LEVEL} />
          )}
          <p>
            Checked <Timestamp iso={block.asOf} />.
          </p>
        </div>
      );
    case AssistantBlockKind.PolicyResults:
      return block.results.hits.length === 0 ? (
        <p>No approved policy matched. Ask your advising office.</p>
      ) : (
        <PolicyHitList hits={block.results.hits} headingLevel={CHAT_CARD_LEVEL} />
      );
    default:
      return <ResultBlock block={block} links={links} />;
  }
}
