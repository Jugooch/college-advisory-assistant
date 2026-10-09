// @vitest-environment jsdom
/**
 * @file Tests for the transcript region: focusable and named, pending rows, and the scroll call
 * with and without reduced motion.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { syntheticId } from '@caa/test-kit';

import type { ChatItem } from '../utils/chat-items';
import { PENDING_REPLY_TEXT } from '../utils/conversation-wording';
import { ChatTranscriptRegion } from './chat-transcript-region';

const STUDENT_ID = syntheticId('student', 1);
const scrollIntoView = vi.fn<(options: ScrollIntoViewOptions) => void>();
const FIRST: ChatItem = { key: 'you-1', kind: 'student', text: 'First question' };
const SECOND: ChatItem = { key: 'you-2', kind: 'student', text: 'Second question' };

/**
 * Stubs the reduced-motion query and `scrollIntoView`.
 *
 * @param isReduced - Whether the student prefers reduced motion.
 */
function stubBrowser(isReduced: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: isReduced })),
  );
  Element.prototype.scrollIntoView = scrollIntoView;
}

describe('ChatTranscriptRegion', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    scrollIntoView.mockReset();
  });

  it('is a named, keyboard-focusable region around the conversation list', () => {
    stubBrowser(false);
    render(<ChatTranscriptRegion items={[FIRST]} studentId={STUDENT_ID} pendingText={null} />);

    const region = screen.getByRole('region', { name: 'Conversation transcript' });

    expect(region.getAttribute('tabindex')).toBe('0');
    expect(within(region).getByRole('list', { name: 'Conversation' })).toBeTruthy();
  });

  it('shows the pending message and one pending assistant row', () => {
    stubBrowser(false);
    render(<ChatTranscriptRegion items={[]} studentId={STUDENT_ID} pendingText="Can I drop?" />);

    expect(screen.getByText('Can I drop?')).toBeTruthy();
    expect(screen.getAllByText(PENDING_REPLY_TEXT)).toHaveLength(1);
    expect(screen.getAllByText('Assistant')).toHaveLength(1);
  });

  it('shows no pending row when nothing is pending', () => {
    stubBrowser(false);
    render(<ChatTranscriptRegion items={[FIRST]} studentId={STUDENT_ID} pendingText={null} />);

    expect(screen.queryByText(PENDING_REPLY_TEXT)).toBeNull();
  });

  it('does not scroll on first render, then scrolls smoothly to the newest row', () => {
    stubBrowser(false);
    const view = render(
      <ChatTranscriptRegion items={[FIRST]} studentId={STUDENT_ID} pendingText={null} />,
    );
    expect(scrollIntoView).not.toHaveBeenCalled();

    view.rerender(
      <ChatTranscriptRegion items={[FIRST]} studentId={STUDENT_ID} pendingText="Hello" />,
    );
    view.rerender(
      <ChatTranscriptRegion items={[FIRST, SECOND]} studentId={STUDENT_ID} pendingText={null} />,
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'start', behavior: 'smooth' });
  });

  it('does not animate the scroll under reduced motion', () => {
    stubBrowser(true);
    const view = render(
      <ChatTranscriptRegion items={[FIRST]} studentId={STUDENT_ID} pendingText={null} />,
    );

    view.rerender(
      <ChatTranscriptRegion items={[FIRST, SECOND]} studentId={STUDENT_ID} pendingText={null} />,
    );

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
  });
});
