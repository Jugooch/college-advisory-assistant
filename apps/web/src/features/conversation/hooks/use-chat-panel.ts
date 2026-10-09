/**
 * @file Client state for the chat panel: composes the transcript, feedback, send and reload.
 * @module @caa/web/features/conversation/hooks/use-chat-panel
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import type { RefObject, SubmitEvent } from 'react';

import type { ConversationResponse, ScheduleOptionsRequest } from '@caa/api-contract';

import type { ChatProblem, ReloadResult, SendTurnResult } from '../utils/conversation-state';
import { CLEARED_ANNOUNCEMENT } from '../utils/conversation-wording';
import { useChatFeedback } from './use-chat-feedback';
import { useChatReload } from './use-chat-reload';
import { useChatSend } from './use-chat-send';
import { type ChatTranscript, useChatTranscript } from './use-chat-transcript';

/** What {@link useChatPanel} needs. */
export interface ChatPanelInput {
  readonly studentId: string;
  readonly termId: string;
  readonly plannerInputs: ScheduleOptionsRequest | null;
  readonly initial: ConversationResponse;
  readonly sendAction: (studentId: string, request: unknown) => Promise<SendTurnResult>;
  readonly reloadAction: (studentId: string, termId: string) => Promise<ReloadResult>;
}

/** What {@link useChatPanel} returns. */
export interface ChatPanelState {
  readonly transcript: ChatTranscript;
  readonly message: string;
  readonly setMessage: (message: string) => void;
  readonly problem: ChatProblem | null;
  readonly setProblem: (problem: ChatProblem | null) => void;
  readonly announcement: string;
  readonly isPending: boolean;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly submit: (event: SubmitEvent<HTMLFormElement>) => void;
  /** Empties the transcript after a clear, announces it, and returns focus to the input. */
  readonly markCleared: () => void;
}

/**
 * Holds the panel's state by composing the focused hooks.
 *
 * @param input - The student, term, form inputs, initial transcript and the send and reload actions.
 * @returns The state and handlers.
 */
export function useChatPanel(input: ChatPanelInput): ChatPanelState {
  const { studentId, termId, plannerInputs, initial, sendAction, reloadAction } = input;
  const transcript = useChatTranscript(initial);
  const feedback = useChatFeedback();
  const reload = useChatReload({
    studentId,
    termId,
    reloadAction,
    transcript,
    setProblem: feedback.setProblem,
    finish: feedback.finish,
  });
  const send = useChatSend({
    studentId,
    termId,
    plannerInputs,
    sendAction,
    transcript,
    feedback,
    reload,
  });
  const markCleared = (): void => {
    transcript.empty();
    feedback.setProblem(null);
    feedback.finish(CLEARED_ANNOUNCEMENT);
  };
  return { ...send, ...feedback, transcript, markCleared };
}
