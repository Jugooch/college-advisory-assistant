/**
 * @file The blocks of one assistant turn. Policy results, notices and referrals render their
 * structured fields; result blocks render the shared verified cards; suggestions are confirmable.
 * @module @caa/web/features/conversation/components/assistant-blocks
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { ReactElement } from 'react';

import type { AssistantBlock } from '@caa/api-contract';

import { studentLinks } from '../utils/student-links';
import { BlockBody } from './block-body';

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
