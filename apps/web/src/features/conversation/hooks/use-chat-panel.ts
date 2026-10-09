/**
 * @file Client state for the chat panel: the message box, sending, the failure to show, and the
 * one polite announcement per turn.
 * @module @caa/web/features/conversation/hooks/use-chat-panel
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { type RefObject, type SubmitEvent, useRef, useState, useTransition } from 'react';

import type { ConversationResponse, ScheduleOptionsRequest } from '@caa/api-contract';

import { type ChatProblem, problemFrom, type SendTurnResult } from '../utils/conversation-state';
import {
  CLEARED_ANNOUNCEMENT,
  CONFLICT_ANNOUNCEMENT,
  REPLY_ANNOUNCEMENT,
} from '../utils/conversation-wording';
import { buildTurnRequest } from '../utils/turn-request';
import { type ChatTranscript, useChatTranscript } from './use-chat-transcript';

/** What {@link useChatPanel} needs. */
export interface ChatPanelInput {
  readonly studentId: string;
  readonly termId: string;
  readonly plannerInputs: ScheduleOptionsRequest | null;
  readonly initial: ConversationResponse;
  readonly sendAction: (studentId: string, request: unknown) => Promise<SendTurnResult>;
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
 * Holds the panel's state. Only the message, the term, the latest sequence seen and the form's
 * confirmed inputs are sent; prior turns never are.
 *
 * @param input - The student, term, form inputs, initial transcript and the send action.
 * @returns The state and handlers.
 */
export function useChatPanel(input: ChatPanelInput): ChatPanelState {
  const { studentId, termId, plannerInputs, initial, sendAction } = input;
  const transcript = useChatTranscript(initial);
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState<ChatProblem | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const finish = (text: string): void => {
    setAnnouncement(text);
    inputRef.current?.focus();
  };
  const show = (result: SendTurnResult, text: string): void => {
    if (result.kind === 'replied') {
      transcript.addExchange(text, result.turn, result.lastSequence);
      setMessage('');
      finish(REPLY_ANNOUNCEMENT);
    } else if (result.kind === 'conflict') {
      transcript.reload(result.conversation);
      finish(CONFLICT_ANNOUNCEMENT);
    } else {
      setProblem(problemFrom(result));
      finish('');
    }
  };
  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const text = message.trim();
    if (text === '' || isPending) {
      return;
    }
    setProblem(null);
    setAnnouncement('');
    startTransition(async () => {
      const request = buildTurnRequest({
        termId,
        message: text,
        expectedSequence: transcript.sequence,
        plannerInputs,
      });
      show(await sendAction(studentId, request), text);
    });
  };
  const markCleared = (): void => {
    transcript.empty();
    setProblem(null);
    finish(CLEARED_ANNOUNCEMENT);
  };
  const state = { message, setMessage, problem, setProblem, announcement, isPending, inputRef };
  return { ...state, transcript, submit, markCleared };
}
