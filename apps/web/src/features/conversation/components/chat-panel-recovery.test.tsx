// @vitest-environment jsdom
/**
 * @file Tests for the chat panel's recovery paths: unstored replies, conflicts, failures and clearing.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { type ConversationResponse, ScheduleOptionsRequestSchema } from '@caa/api-contract';
import { ModelStatus } from '@caa/domain';
import {
  buildAssistantTurnView,
  buildConversationResponse,
  buildScheduleConstraintSet,
  buildStoredAssistantTurnView,
  buildStudentTurnView,
  syntheticId,
} from '@caa/test-kit';

import type { ClearResult, ReloadResult, SendTurnResult } from '../utils/conversation-state';
import { EMPTY_CHAT_INTRO } from '../utils/conversation-wording';
import { ChatPanel } from './chat-panel';

const STUDENT_ID = syntheticId('student', 1);
const TERM_ID = syntheticId('term', 1);
const INPUTS = ScheduleOptionsRequestSchema.parse({
  termId: TERM_ID,
  courseIds: [syntheticId('course', 1)],
  creditSelections: [],
  constraints: buildScheduleConstraintSet(),
});

/**
 * Renders the panel with mock actions.
 *
 * @param options - The initial conversation and the action results.
 * @returns The mocks.
 */
function renderPanel({
  initial = buildConversationResponse({ turns: [], lastSequence: 0 }),
  send = { kind: 'replied', turn: buildAssistantTurnView() },
  clear = { kind: 'cleared' },
  reload = {
    kind: 'loaded',
    conversation: buildConversationResponse({ turns: [], lastSequence: 0 }),
  },
}: {
  initial?: ConversationResponse;
  send?: SendTurnResult;
  clear?: ClearResult;
  reload?: ReloadResult;
} = {}) {
  const sendAction = vi.fn<(studentId: string, request: unknown) => Promise<SendTurnResult>>();
  sendAction.mockResolvedValue(send);
  const clearAction = vi.fn<(studentId: string, termId: string) => Promise<ClearResult>>();
  clearAction.mockResolvedValue(clear);
  const reloadAction = vi.fn<(studentId: string, termId: string) => Promise<ReloadResult>>();
  reloadAction.mockResolvedValue(reload);
  render(
    <ChatPanel
      studentId={STUDENT_ID}
      termId={TERM_ID}
      plannerInputs={INPUTS}
      initial={initial}
      sendAction={sendAction}
      reloadAction={reloadAction}
      clearAction={clearAction}
    />,
  );
  return { sendAction, clearAction, reloadAction };
}

/**
 * Types a message and submits the form.
 *
 * @param text - The message.
 */
function sendMessage(text: string): void {
  const input = screen.getByLabelText('Message to the assistant');
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
}

beforeAll(() => {
  // jsdom has no layout, so it lacks scrollIntoView, which the transcript calls.
  Element.prototype.scrollIntoView = vi.fn();
});

describe('ChatPanel recovery', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps the same sequence after an isUnstored reply', async () => {
    const { sendAction } = renderPanel({
      send: {
        kind: 'replied',
        turn: buildAssistantTurnView({
          modelStatus: ModelStatus.Disabled,
          sequence: null,
          blocks: [],
        }),
      },
    });

    sendMessage('One');
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).not.toBe('');
    });
    sendMessage('Two');
    await waitFor(() => {
      expect(sendAction).toHaveBeenCalledTimes(2);
    });

    expect(sendAction.mock.calls[1]?.[1]).toMatchObject({ expectedSequence: 0 });
  });

  it('reloads the transcript on a conflict and keeps the message', async () => {
    const reloaded = buildConversationResponse({
      turns: [buildStudentTurnView({ text: 'Earlier question' }), buildStoredAssistantTurnView()],
      lastSequence: 2,
    });
    renderPanel({
      send: { kind: 'conflict' },
      reload: { kind: 'loaded', conversation: reloaded },
    });

    sendMessage('Hello');

    await waitFor(() => {
      expect(screen.getByText('Earlier question')).toBeTruthy();
    });
    expect(screen.getByRole('status').textContent).toContain('reloaded');
    expect(screen.getByLabelText('Message to the assistant')).toHaveProperty('value', 'Hello');
  });

  it('shows a failure as an alert with the support reference', async () => {
    renderPanel({
      send: {
        kind: 'failed',
        code: 'INTERNAL_ERROR',
        message: 'Something broke.',
        requestId: 'req-5',
      },
    });

    sendMessage('Hello');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Something broke.');
    expect(alert.textContent).toContain('req-5');
  });

  it('asks before clearing, then clears and refocuses the input', async () => {
    const { clearAction } = renderPanel({
      initial: buildConversationResponse({ lastSequence: 2 }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear conversation' }));
    const group = screen.getByRole('group');
    expect(clearAction).not.toHaveBeenCalled();
    fireEvent.click(within(group).getByRole('button', { name: 'Yes, clear it' }));

    await waitFor(() => {
      expect(screen.getByText(EMPTY_CHAT_INTRO)).toBeTruthy();
    });
    expect(clearAction).toHaveBeenCalledWith(STUDENT_ID, TERM_ID);
    expect(screen.getByRole('status').textContent).toBe('Conversation cleared.');
    expect(document.activeElement).toBe(screen.getByLabelText('Message to the assistant'));
  });

  it('sends the server lastSequence after a clear, not 0', async () => {
    const { sendAction } = renderPanel({
      initial: buildConversationResponse({ lastSequence: 2 }),
      send: { kind: 'replied', turn: buildAssistantTurnView({ sequence: 4 }), lastSequence: 4 },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear conversation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, clear it' }));
    await waitFor(() => {
      expect(screen.getByText(EMPTY_CHAT_INTRO)).toBeTruthy();
    });
    sendMessage('After clear');
    await waitFor(() => {
      expect(sendAction).toHaveBeenCalledTimes(1);
    });
    expect(sendAction.mock.calls[0]?.[1]).toMatchObject({ expectedSequence: 2 });

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).not.toBe('');
    });
    sendMessage('Again');
    await waitFor(() => {
      expect(sendAction).toHaveBeenCalledTimes(2);
    });
    expect(sendAction.mock.calls[1]?.[1]).toMatchObject({ expectedSequence: 4 });
  });

  it('uses the reloaded lastSequence after a conflict', async () => {
    const reloaded = buildConversationResponse({ turns: [], lastSequence: 6 });
    const { sendAction } = renderPanel({
      send: { kind: 'conflict' },
      reload: { kind: 'loaded', conversation: reloaded },
    });

    sendMessage('One');
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('reloaded');
    });
    sendMessage('Two');
    await waitFor(() => {
      expect(sendAction).toHaveBeenCalledTimes(2);
    });

    expect(sendAction.mock.calls[0]?.[1]).toMatchObject({ expectedSequence: 0 });
    expect(sendAction.mock.calls[1]?.[1]).toMatchObject({ expectedSequence: 6 });
  });

  it('keeps the conversation when the student declines, returning focus to the control', () => {
    const { clearAction } = renderPanel({
      initial: buildConversationResponse({ lastSequence: 2 }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear conversation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));

    expect(clearAction).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Clear conversation' }));
  });

  it('asks the reload action once on a conflict, for the same student and term', async () => {
    const { reloadAction } = renderPanel({ send: { kind: 'conflict' } });

    sendMessage('Hello');

    await waitFor(() => {
      expect(reloadAction).toHaveBeenCalledTimes(1);
    });
    expect(reloadAction).toHaveBeenCalledWith(STUDENT_ID, TERM_ID);
  });

  it('shows the failure when the reload after a conflict fails', async () => {
    renderPanel({
      send: { kind: 'conflict' },
      reload: {
        kind: 'failed',
        code: 'INTERNAL_ERROR',
        message: 'Reload broke.',
        requestId: 'req-9',
      },
    });

    sendMessage('Hello');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Reload broke.');
    expect(alert.textContent).toContain('req-9');
  });

  it('keeps the transcript and refocuses the control when clearing fails', async () => {
    renderPanel({
      initial: buildConversationResponse({ lastSequence: 2 }),
      clear: { kind: 'failed', code: 'INTERNAL_ERROR', message: 'Clear broke.', requestId: null },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear conversation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, clear it' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Clear broke.');
    expect(screen.getByRole('list', { name: 'Conversation' })).toBeTruthy();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Clear conversation' }),
      );
    });
  });
});
