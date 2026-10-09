/**
 * @file Client state for sending a turn: the message box and the pending send. Only the message,
 * the term, the latest sequence seen and the form's confirmed inputs are sent; prior turns never are.
 * @module @caa/web/features/conversation/hooks/use-chat-send
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { type SubmitEvent, useState, useTransition } from 'react';

import type { ScheduleOptionsRequest } from '@caa/api-contract';

import { problemFrom, type SendTurnResult } from '../utils/conversation-state';
import { REPLY_ANNOUNCEMENT } from '../utils/conversation-wording';
import { buildTurnRequest } from '../utils/turn-request';
import type { ChatFeedback } from './use-chat-feedback';
import type { ChatTranscript } from './use-chat-transcript';

/** What {@link useChatSend} needs. */
export interface ChatSendInput {
  readonly studentId: string;
  readonly termId: string;
  readonly plannerInputs: ScheduleOptionsRequest | null;
  readonly sendAction: (studentId: string, request: unknown) => Promise<SendTurnResult>;
  readonly transcript: ChatTranscript;
  readonly feedback: Pick<ChatFeedback, 'setProblem' | 'setAnnouncement' | 'finish'>;
  /** Reloads the transcript after a sequence conflict. */
  readonly reload: () => Promise<void>;
}

/** What {@link useChatSend} returns. */
export interface ChatSend {
  readonly message: string;
  readonly setMessage: (message: string) => void;
  readonly isPending: boolean;
  /** The message being sent, or null when no turn is pending. */
  readonly pendingText: string | null;
  readonly submit: (event: SubmitEvent<HTMLFormElement>) => void;
}

/**
 * Holds the message box and sends a turn on submit.
 *
 * @param input - The student, term, form inputs, send action, transcript and handlers.
 * @returns The message, whether a send is pending, and the submit handler.
 */
export function useChatSend(input: ChatSendInput): ChatSend {
  const { studentId, termId, plannerInputs, sendAction, transcript, feedback, reload } = input;
  const [message, setMessage] = useState('');
  const [sentText, setSentText] = useState('');
  const [isPending, startTransition] = useTransition();

  const show = async (result: SendTurnResult, text: string): Promise<void> => {
    if (result.kind === 'replied') {
      transcript.addExchange(text, result.turn, result.lastSequence);
      setMessage('');
      feedback.finish(REPLY_ANNOUNCEMENT);
    } else if (result.kind === 'conflict') {
      await reload();
    } else {
      feedback.setProblem(problemFrom(result));
      feedback.finish('');
    }
  };
  const submit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const text = message.trim();
    if (text === '' || isPending) {
      return;
    }
    feedback.setProblem(null);
    feedback.setAnnouncement('');
    setSentText(text);
    startTransition(async () => {
      const request = buildTurnRequest({
        termId,
        message: text,
        expectedSequence: transcript.sequence,
        plannerInputs,
      });
      await show(await sendAction(studentId, request), text);
    });
  };
  return { message, setMessage, isPending, pendingText: isPending ? sentText : null, submit };
}
