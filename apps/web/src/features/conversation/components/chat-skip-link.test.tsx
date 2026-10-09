// @vitest-environment jsdom
/**
 * @file Tests for the stacked-layout skip link.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ChatSkipLink } from './chat-skip-link';

describe('ChatSkipLink', () => {
  afterEach(cleanup);

  it('moves focus to the chat heading', () => {
    render(
      <>
        <ChatSkipLink />
        <h2 id="chat-heading" tabIndex={-1}>
          Ask the assistant
        </h2>
      </>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Go to the assistant' }));

    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Ask the assistant' }));
  });

  it('points at the heading by id, so it works without a click handler', () => {
    render(<ChatSkipLink />);

    expect(screen.getByRole('link', { name: 'Go to the assistant' }).getAttribute('href')).toBe(
      '#chat-heading',
    );
  });
});
