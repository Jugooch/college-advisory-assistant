// @vitest-environment jsdom
/**
 * @file Tests for the chat panel: every model status, unavailable chat, the live announcement,
 * focus, the request body, conflicts and clearing.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type ConversationResponse, ScheduleOptionsRequestSchema } from '@caa/api-contract';
import { ModelStatus } from '@caa/domain';
import {
  buildAssistantBlockRefOfEveryKind,
  buildAssistantTurnView,
  buildConversationResponse,
  buildNoticeBlock,
  buildReferralBlock,
  buildScheduleConstraintSet,
  buildStoredAssistantTurnView,
  buildStudentTurnView,
  buildUnavailableConversationResponse,
  syntheticId,
} from '@caa/test-kit';

import type { ClearResult, SendTurnResult } from '../utils/conversation-state';
import { STATUS_NOTICES } from '../utils/conversation-wording';
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
  initial = buildConversationResponse({ turns: [] }),
  send = { kind: 'replied', turn: buildAssistantTurnView() },
  clear = { kind: 'cleared' },
}: {
  initial?: ConversationResponse;
  send?: SendTurnResult;
  clear?: ClearResult;
} = {}) {
  const sendAction = vi.fn<(studentId: string, request: unknown) => Promise<SendTurnResult>>();
  sendAction.mockResolvedValue(send);
  const clearAction = vi.fn<(studentId: string, termId: string) => Promise<ClearResult>>();
  clearAction.mockResolvedValue(clear);
  render(
    <ChatPanel
      studentId={STUDENT_ID}
      termId={TERM_ID}
      plannerInputs={INPUTS}
      initial={initial}
      sendAction={sendAction}
      clearAction={clearAction}
    />,
  );
  return { sendAction, clearAction };
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

describe('ChatPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('says it is not registration', () => {
    renderPanel();

    expect(screen.getByText(/This chat is not registration/)).toBeTruthy();
  });

  it('shows only the unavailable message when chat is unavailable', () => {
    renderPanel({ initial: buildUnavailableConversationResponse() });

    expect(screen.getByText(/Chat is unavailable right now/)).toBeTruthy();
    expect(screen.queryByLabelText('Message to the assistant')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear conversation' })).toBeNull();
  });

  it('sends the message, term, latest sequence and inputs, and no prior turns', async () => {
    const initial = buildConversationResponse({
      turns: [buildStudentTurnView(), buildStoredAssistantTurnView()],
    });
    const { sendAction } = renderPanel({ initial });

    sendMessage('  Can I drop late? ');
    await waitFor(() => {
      expect(sendAction).toHaveBeenCalledTimes(1);
    });

    expect(sendAction).toHaveBeenCalledWith(STUDENT_ID, {
      termId: TERM_ID,
      message: 'Can I drop late?',
      expectedSequence: 2,
      plannerInputs: INPUTS,
    });
  });

  it('shows the reply under an Assistant label, announces once, and refocuses the input', async () => {
    renderPanel({
      send: { kind: 'replied', turn: buildAssistantTurnView({ intro: 'Here you go.' }) },
    });

    sendMessage('Hello');

    await waitFor(() => {
      expect(screen.getByText('Here you go.')).toBeTruthy();
    });
    expect(screen.getByText('Assistant')).toBeTruthy();
    expect(screen.getByText('Hello')).toBeTruthy();
    const live = screen.getByRole('status');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.textContent).toBe('The assistant replied.');
    expect(document.activeElement).toBe(screen.getByLabelText('Message to the assistant'));
    expect(screen.getByLabelText('Message to the assistant')).toHaveProperty('value', '');
  });

  it('does not render an empty intro', async () => {
    renderPanel({
      send: {
        kind: 'replied',
        turn: buildAssistantTurnView({ intro: '', blocks: [buildReferralBlock()] }),
      },
    });

    sendMessage('Hello');

    await waitFor(() => {
      expect(screen.getByText(/Financial aid questions go to/)).toBeTruthy();
    });
    expect(screen.queryByText('Assistant')).toBeNull();
  });

  it('renders policy results through the shared hit list', async () => {
    renderPanel();

    sendMessage('Hello');

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { level: 3 }).length).toBeGreaterThan(0);
    });
  });

  it.each([
    ModelStatus.BudgetExhausted,
    ModelStatus.ModelUnavailable,
    ModelStatus.RateLimited,
    ModelStatus.Disabled,
  ])('shows the %s notice with a link to the form', async (status) => {
    const isUnstored = status === ModelStatus.RateLimited || status === ModelStatus.Disabled;
    renderPanel({
      send: {
        kind: 'replied',
        turn: buildAssistantTurnView({
          modelStatus: status,
          sequence: isUnstored ? null : 2,
          intro: '',
          blocks: [],
        }),
      },
    });

    sendMessage('Hello');

    const text = STATUS_NOTICES[status] ?? '';
    await waitFor(() => {
      expect(screen.getByText(text, { exact: false })).toBeTruthy();
    });
    expect(text).toContain('planner form still works');
    const link = screen.getByRole('link', { name: 'Go to the planner form' });
    expect(link.getAttribute('href')).toBe(`/next-term-planner?studentId=${STUDENT_ID}`);
  });

  it.each([ModelStatus.Answered, ModelStatus.Guarded])(
    'shows the intro for %s with no status notice',
    async (modelStatus) => {
      renderPanel({
        send: {
          kind: 'replied',
          turn: buildAssistantTurnView({ modelStatus, intro: 'Server text.' }),
        },
      });

      sendMessage('Hello');

      await waitFor(() => {
        expect(screen.getByText('Server text.')).toBeTruthy();
      });
      expect(screen.queryByRole('link', { name: 'Go to the planner form' })).toBeNull();
    },
  );

  it('shows a crisis referral returned with a rate-limited status', async () => {
    renderPanel({
      send: {
        kind: 'replied',
        turn: buildAssistantTurnView({
          modelStatus: ModelStatus.RateLimited,
          sequence: null,
          intro: '',
          blocks: [buildNoticeBlock(), buildReferralBlock()],
        }),
      },
    });

    sendMessage('Hello');

    await waitFor(() => {
      expect(screen.getByText(/Financial aid questions go to/)).toBeTruthy();
    });
    expect(screen.getByText(/Please wait a moment/)).toBeTruthy();
  });

  it('shows past results only as references with a link, never a result', () => {
    renderPanel({
      initial: buildConversationResponse({
        turns: [
          buildStudentTurnView(),
          buildStoredAssistantTurnView({ blockRefs: buildAssistantBlockRefOfEveryKind() }),
        ],
      }),
    });

    expect(screen.getAllByText(/shown at/).length).toBe(2);
    expect(screen.getByRole('link', { name: 'Rerun it on the planner' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Overview' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
  });
});
