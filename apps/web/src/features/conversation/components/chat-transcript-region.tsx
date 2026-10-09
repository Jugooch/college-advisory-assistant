'use client';
/**
 * @file The bounded, scrollable transcript. It is a keyboard-focusable named region, keeps the
 * newest turn in view, and shows the student's message and a pending assistant row while a turn
 * is in flight. The pending row sits outside the polite live region, so only the reply is announced.
 * @module @caa/web/features/conversation/components/chat-transcript-region
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import { type ReactElement, useEffect, useRef } from 'react';

import type { ChatItem } from '../utils/chat-items';
import { PENDING_REPLY_TEXT } from '../utils/conversation-wording';
import { transcriptScrollBehavior } from '../utils/scroll-behavior';
import { ChatItemView } from './chat-item-view';

/** Makes the scrolling region reachable by keyboard. */
const SCROLL_FOCUS = { tabIndex: 0 };

/** Props for {@link ChatTranscriptRegion}. */
export interface ChatTranscriptRegionProps {
  readonly items: readonly ChatItem[];
  readonly studentId: string;
  /** The message being sent, or null when no turn is pending. */
  readonly pendingText: string | null;
}

/**
 * Renders the transcript and scrolls the newest turn into view after each change, but not on
 * first render.
 *
 * @param props - The items, the student and the pending message.
 * @returns The region.
 */
export function ChatTranscriptRegion({
  items,
  studentId,
  pendingText,
}: ChatTranscriptRegionProps): ReactElement {
  const listRef = useRef<HTMLOListElement>(null);
  const hasRendered = useRef(false);
  const newest = pendingText === null ? (items.at(-1)?.key ?? '') : 'pending';
  useEffect(() => {
    if (!hasRendered.current) {
      hasRendered.current = true;
      return;
    }
    listRef.current?.lastElementChild?.scrollIntoView({
      block: 'start',
      behavior: transcriptScrollBehavior(),
    });
  }, [newest]);
  return (
    // The region scrolls, so it must take focus for keyboard users (axe scrollable-region-focusable,
    // WCAG 2.1.1); jsx-a11y's static rule can't tell, so the focusability is spread in.
    <div
      className="chat-transcript-region"
      role="region"
      aria-label="Conversation transcript"
      {...SCROLL_FOCUS}
    >
      <ol className="chat-transcript" aria-label="Conversation" ref={listRef}>
        {items.map((item) => (
          <ChatItemView key={item.key} item={item} studentId={studentId} />
        ))}
        {pendingText === null ? null : (
          <>
            <ChatItemView
              item={{ key: 'pending-you', kind: 'student', text: pendingText }}
              studentId={studentId}
            />
            <li className="chat-turn chat-turn--assistant chat-turn--pending">
              <p className="chat-turn-label">Assistant</p>
              <p className="chat-text">{PENDING_REPLY_TEXT}</p>
            </li>
          </>
        )}
      </ol>
    </div>
  );
}
