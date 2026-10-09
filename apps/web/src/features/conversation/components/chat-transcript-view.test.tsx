// @vitest-environment jsdom
/**
 * @file Tests for the transcript view: bounded focusable region, pending row, scrolling with
 * reduced motion, and the skip link.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';
import {
  buildAssistantTurnView,
  buildConversationResponse,
  buildStoredAssistantTurnView,
  buildStudentTurnView,
  syntheticId,
} from '@caa/test-kit';

import type { ClearResult, ReloadResult, SendTurnResult } from '../utils/conversation-state';
import { PENDING_REPLY_TEXT } from '../utils/conversation-wording';
import { ChatPanel } from './chat-panel';
import { ChatSkipLink } from './chat-skip-link';

const scrollIntoView = vi.fn<(options: ScrollIntoViewOptions) => void>();

/**
 * Renders the panel with a send that resolves when the test says so.
 *
 * @param turnCount - How many stored exchanges to start with.
 * @returns The deferred resolver.
 */
function renderPanel(turnCount = 0): { settle: (result: SendTurnResult) => Promise<void> } {
  let resolve: (result: SendTurnResult) => void = () => undefined;
  const sendAction = vi.fn(
    () =>
      new Promise<SendTurnResult>((done) => {
        resolve = done;
      }),
  );
  const turns = Array.from({ length: turnCount }, (_, index) => [
    buildStudentTurnView({ sequence: index * 2 + 1 }),
    buildStoredAssistantTurnView({ sequence: index * 2 + 2 }),
  ]).flat();
  render(
    <ChatPanel
      studentId={syntheticId('student', 1)}
      termId={syntheticId('term', 1)}
      plannerInputs={null}
      initial={buildConversationResponse({ turns })}
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

/**
 * Stubs the reduced-motion media query.
 *
 * @param reduces - Whether the student prefers reduced motion.
 */
function stubMotion(reduces: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduces })),
  );
}

describe('chat transcript view', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    scrollIntoView.mockReset();
  });

  it('is a named, keyboard-focusable region around the conversation', () => {
    renderPanel(10);

    const region = screen.getByRole('region', { name: 'Conversation transcript' });

    expect(region.getAttribute('tabindex')).toBe('0');
    expect(within(region).getByRole('list', { name: 'Conversation' })).toBeTruthy();
  });

  it('shows the message and a pending row at once, outside the live region', async () => {
    const { settle } = renderPanel();

    send('Can I drop late?');

    expect(await screen.findByText(PENDING_REPLY_TEXT)).toBeTruthy();
    expect(
      within(screen.getByRole('region', { name: 'Conversation transcript' })).getByText(
        'Can I drop late?',
      ),
    ).toBeTruthy();
    expect(within(screen.getByRole('status')).queryByText(PENDING_REPLY_TEXT)).toBeNull();

    await settle({ kind: 'replied', turn: buildAssistantTurnView({ intro: 'Here you go.' }) });

    await waitFor(() => {
      expect(screen.queryByText(PENDING_REPLY_TEXT)).toBeNull();
    });
    expect(screen.getByText('Here you go.')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('The assistant replied.');
  });

  it('drops the pending row on a problem and keeps the text in the box', async () => {
    const { settle } = renderPanel();

    send('Can I drop late?');
    await screen.findByText(PENDING_REPLY_TEXT);
    await settle({ kind: 'rejected' });

    await waitFor(() => {
      expect(screen.queryByText(PENDING_REPLY_TEXT)).toBeNull();
    });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByLabelText('Message to the assistant')).toHaveProperty(
      'value',
      'Can I drop late?',
    );
  });

  it('scrolls the newest row into view smoothly, but not on first render', async () => {
    stubMotion(false);
    Element.prototype.scrollIntoView = scrollIntoView;
    const { settle } = renderPanel(1);
    expect(scrollIntoView).not.toHaveBeenCalled();

    send('Hello');
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    });
    await settle({ kind: 'replied', turn: buildAssistantTurnView() });

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('does not animate the scroll under reduced motion', async () => {
    stubMotion(true);
    Element.prototype.scrollIntoView = scrollIntoView;
    renderPanel(1);

    send('Hello');

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
    });
  });
});

describe('ChatSkipLink', () => {
  afterEach(cleanup);

  it('moves focus to the chat heading', () => {
    render(
      <>
        <ChatSkipLink conversation={buildConversationResponse()} />
        <h2 id="chat-heading" tabIndex={-1}>
          Ask the assistant
        </h2>
      </>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Go to the assistant' }));

    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Ask the assistant' }));
  });

  it('is absent when there is no chat panel to go to', () => {
    render(<ChatSkipLink conversation={null} />);
    render(
      <ChatSkipLink
        conversation={
          new ApiError({
            code: ErrorCode.InternalError,
            status: 500,
            message: 'down',
            requestId: null,
          })
        }
      />,
    );

    expect(screen.queryByRole('link')).toBeNull();
  });
});
