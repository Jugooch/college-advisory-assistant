// @vitest-environment jsdom
/**
 * @file Tests for the panel's pending turn: the message and pending row show at once, the reply
 * replaces them with no duplicate, and a problem keeps the text in the box.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildAssistantTurnView, buildConversationResponse, syntheticId } from '@caa/test-kit';

import type { ClearResult, ReloadResult, SendTurnResult } from '../utils/conversation-state';
import { PENDING_REPLY_TEXT } from '../utils/conversation-wording';
import { ChatPanel } from './chat-panel';

/**
 * Renders the panel with a send that resolves when the test says so.
 *
 * @returns The function that settles the send.
 */
function renderPanel(): { settle: (result: SendTurnResult) => Promise<void> } {
  let resolve: (result: SendTurnResult) => void = () => undefined;
  const sendAction = vi.fn(
    () =>
      new Promise<SendTurnResult>((done) => {
        resolve = done;
      }),
  );
  render(
    <ChatPanel
      studentId={syntheticId('student', 1)}
      termId={syntheticId('term', 1)}
      plannerInputs={null}
      initial={buildConversationResponse({ turns: [] })}
      sendAction={sendAction}
      reloadAction={vi.fn<() => Promise<ReloadResult>>()}
      clearAction={vi.fn<() => Promise<ClearResult>>()}
    />,
  );
  return {
    settle: async (result) => {
      await act(async () => {
        resolve(result);
        await Promise.resolve();
      });
    },
  };
}

/**
 * Types and sends a message.
 *
 * @param text - The message.
 */
function send(text: string): void {
  fireEvent.change(screen.getByLabelText('Message to the assistant'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
}

describe('ChatPanel pending turn', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(cleanup);

  it('shows the message and a pending row at once, outside the live region', async () => {
    renderPanel();

    send('Can I drop late?');

    expect(await screen.findByText(PENDING_REPLY_TEXT)).toBeTruthy();
    const region = screen.getByRole('region', { name: 'Conversation transcript' });
    expect(within(region).getByText('Can I drop late?')).toBeTruthy();
    expect(within(screen.getByRole('status')).queryByText(PENDING_REPLY_TEXT)).toBeNull();
  });

  it('replaces the pending rows with the reply, never showing both', async () => {
    const { settle } = renderPanel();
    send('Can I drop late?');
    await screen.findByText(PENDING_REPLY_TEXT);

    await settle({ kind: 'replied', turn: buildAssistantTurnView({ intro: 'Here you go.' }) });

    expect(screen.getByText('Here you go.')).toBeTruthy();
    expect(screen.queryByText(PENDING_REPLY_TEXT)).toBeNull();
    expect(screen.getAllByText('Can I drop late?')).toHaveLength(1);
    expect(screen.getAllByText('Assistant')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toBe('The assistant replied.');
  });

  it('drops the pending rows on a problem and keeps the text in the box', async () => {
    const { settle } = renderPanel();
    send('Can I drop late?');
    await screen.findByText(PENDING_REPLY_TEXT);

    await settle({ kind: 'rejected' });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(screen.queryByText(PENDING_REPLY_TEXT)).toBeNull();
    expect(screen.queryByRole('region', { name: 'Conversation transcript' })).toBeNull();
    expect(screen.getByLabelText('Message to the assistant')).toHaveProperty(
      'value',
      'Can I drop late?',
    );
  });
});
