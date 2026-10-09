'use client';
/**
 * @file A "Go to the assistant" skip link for the stacked layout, where the chat sits under the
 * whole planner form. It is hidden, and out of the tab order, in the side-by-side layout.
 * @module @caa/web/features/conversation/components/chat-skip-link
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { MouseEvent, ReactElement } from 'react';

import { CHAT_HEADING_ID } from '../utils/chat-heading-id';

/**
 * Renders the link. The page renders it only when the chat panel (and so its heading) renders.
 *
 * @returns The link.
 */
export function ChatSkipLink(): ReactElement {
  const go = (event: MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault();
    document.getElementById(CHAT_HEADING_ID)?.focus();
  };
  return (
    <a className="skip-link chat-skip-link" href={`#${CHAT_HEADING_ID}`} onClick={go}>
      Go to the assistant
    </a>
  );
}
