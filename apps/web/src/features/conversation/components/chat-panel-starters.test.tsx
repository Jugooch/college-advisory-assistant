// @vitest-environment jsdom
/**
 * @file Tests for the starter prompts inside the chat panel: fill and focus without sending, and
 * when they appear and disappear.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { type ConversationResponse, ScheduleOptionsRequestSchema } from '@caa/api-contract';
import {
  buildAssistantTurnView,
  buildConversationResponse,
  buildScheduleConstraintSet,
  syntheticId,
} from '@caa/test-kit';

import type { ClearResult, ReloadResult, SendTurnResult } from '../utils/conversation-state';
import { EMPTY_CHAT_INTRO, UNAVAILABLE_MESSAGE } from '../utils/conversation-wording';
import { ChatPanel } from './chat-panel';

const STUDENT_ID = syntheticId('student', 1);
const TERM_ID = syntheticId('term', 1);
const INPUTS = ScheduleOptionsRequestSchema.parse({
  termId: TERM_ID,
  courseIds: [syntheticId('course', 1)],
  creditSelections: [],
  constraints: buildScheduleConstraintSet(),
});

/** A chat-off conversation with no turns. */
const UNAVAILABLE = buildConversationResponse({
  available: false,
  unavailableReason: 'DISABLED',
  turns: [],
  lastSequence: 0,
});

/**
 * Renders the panel with mock actions.
 *
 * @param initial - The initial conversation.
 * @returns The mocks.
 */
function renderPanel(
  initial: ConversationResponse = buildConversationResponse({ turns: [], lastSequence: 0 }),
) {
  const sendAction = vi.fn<(studentId: string, request: unknown) => Promise<SendTurnResult>>();
  sendAction.mockResolvedValue({ kind: 'replied', turn: buildAssistantTurnView() });
  const reloadAction = vi.fn<(studentId: string, termId: string) => Promise<ReloadResult>>();
  const clearAction = vi.fn<(studentId: string, termId: string) => Promise<ClearResult>>();
  clearAction.mockResolvedValue({ kind: 'cleared' });
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
  return { sendAction };
}

beforeAll(() => {
  // jsdom has no layout, so it lacks scrollIntoView, which the transcript calls.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

describe('ChatPanel starter prompts', () => {
  it('fills the box, focuses it and sends nothing when a prompt is clicked', () => {
    const { sendAction } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Show me my options' }));

    const input = screen.getByLabelText<HTMLInputElement>('Message to the assistant');
    expect(input.value).toBe('Show me my options');
    expect(document.activeElement).toBe(input);
    expect(sendAction).not.toHaveBeenCalled();
  });

  it('hides the prompts once the transcript has a turn', () => {
    renderPanel(buildConversationResponse({ lastSequence: 2 }));

    expect(screen.queryByText(EMPTY_CHAT_INTRO)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show me my options' })).toBeNull();
  });

  it('brings the prompts back after the conversation is cleared', async () => {
    renderPanel(buildConversationResponse({ lastSequence: 2 }));

    fireEvent.click(screen.getByRole('button', { name: 'Clear conversation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, clear it' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Show me my options' })).toBeTruthy();
    });
  });

  it('shows no prompts when chat is unavailable', () => {
    renderPanel(UNAVAILABLE);

    expect(screen.getByText(UNAVAILABLE_MESSAGE)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show me my options' })).toBeNull();
  });

  it('shows only the unavailable message, with no input or clear control', () => {
    renderPanel(UNAVAILABLE);

    expect(screen.getByText(/Chat is unavailable right now/)).toBeTruthy();
    expect(screen.queryByLabelText('Message to the assistant')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear conversation' })).toBeNull();
  });
});
