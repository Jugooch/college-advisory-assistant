'use client';
/**
 * @file A "Go to the assistant" skip link for the stacked layout, where the chat sits under the
 * whole planner form. It is hidden, and out of the tab order, in the side-by-side layout.
 * @module @caa/web/features/conversation/components/chat-skip-link
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { MouseEvent, ReactElement } from 'react';

import { ApiError, type ConversationResponse } from '@caa/api-contract';

import { CHAT_HEADING_ID } from '../utils/conversation-wording';

/** Props for {@link ChatSkipLink}. */
export interface ChatSkipLinkProps {
  /** The API's answer, its error, or null; the link shows only when the panel will render. */
  readonly conversation: ConversationResponse | ApiError | null;
}

/**
 * Renders the link, or nothing when there is no chat heading to move to.
 *
 * @param props - The conversation the page loaded.
 * @returns The link or null.
 */
export function ChatSkipLink({ conversation }: ChatSkipLinkProps): ReactElement | null {
  if (conversation === null || conversation instanceof ApiError) {
    return null;
  }
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
