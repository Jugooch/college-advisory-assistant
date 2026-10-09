/**
 * @file Client state for what the chat panel tells the student: the failure to show, the one
 * polite announcement per turn, and returning focus to the message box.
 * @module @caa/web/features/conversation/hooks/use-chat-feedback
 * @requirement FR-10
 * @requirement NFR-02
 */
import { type RefObject, useRef, useState } from 'react';

import type { ChatProblem } from '../utils/conversation-state';

/** What {@link useChatFeedback} returns. */
export interface ChatFeedback {
  readonly problem: ChatProblem | null;
  readonly setProblem: (problem: ChatProblem | null) => void;
  readonly announcement: string;
  readonly setAnnouncement: (announcement: string) => void;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  /** Announces `text` and returns focus to the message box. */
  readonly finish: (text: string) => void;
}

/**
 * Holds the problem, the announcement and the input's focus.
 *
 * @returns The state and handlers.
 */
export function useChatFeedback(): ChatFeedback {
  const [problem, setProblem] = useState<ChatProblem | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const finish = (text: string): void => {
    setAnnouncement(text);
    inputRef.current?.focus();
  };
  return { problem, setProblem, announcement, setAnnouncement, inputRef, finish };
}
