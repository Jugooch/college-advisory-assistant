/**
 * @file One transcript item: the student's message, a stored assistant turn, or a fresh reply.
 * The assistant's intro sits under an "Assistant" label, apart from verified content.
 * @module @caa/web/features/conversation/components/chat-item-view
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { ReactElement } from 'react';

import type { ChatItem } from '../utils/chat-items';
import { studentLinks } from '../utils/student-links';
import { AssistantBlocks } from './assistant-blocks';
import { StatusNotice } from './status-notice';
import { StoredBlockRefs } from './stored-block-refs';

/** Props for {@link ChatItemView}. */
export interface ChatItemViewProps {
  readonly item: ChatItem;
  readonly studentId: string;
}

/**
 * Renders the item as a list entry.
 *
 * @param props - The item and the student.
 * @returns The list entry.
 */
export function ChatItemView({ item, studentId }: ChatItemViewProps): ReactElement {
  const links = studentLinks(studentId);
  if (item.kind === 'student') {
    return (
      <li className="chat-turn chat-turn--student">
        <p className="chat-turn-label">You</p>
        <p className="chat-text">{item.text}</p>
      </li>
    );
  }
  const { intro, modelStatus } = item.turn;
  return (
    <li className="chat-turn chat-turn--assistant">
      {intro === '' ? null : (
        <>
          <p className="chat-turn-label">Assistant</p>
          <p className="chat-text">{intro}</p>
        </>
      )}
      <StatusNotice status={modelStatus} formHref={links.planner} />
      {item.kind === 'live' ? (
        <AssistantBlocks blocks={item.turn.blocks} studentId={studentId} />
      ) : (
        <StoredBlockRefs refs={item.turn.blockRefs} links={links} />
      )}
    </li>
  );
}
