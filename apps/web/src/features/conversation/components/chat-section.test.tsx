// @vitest-environment jsdom
/**
 * @file Tests for the chat column: it shows the panel, or a plain note that never blocks the form.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';
import { buildConversationResponse, syntheticId } from '@caa/test-kit';

import { ChatSection } from './chat-section';

const BASE = {
  studentId: syntheticId('student', 1),
  termId: syntheticId('term', 1),
  plannerInputs: null,
  sendAction: vi.fn(),
  reloadAction: vi.fn(),
  clearAction: vi.fn(),
};

describe('ChatSection', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the panel when the transcript loaded', () => {
    render(<ChatSection {...BASE} conversation={buildConversationResponse()} />);

    expect(screen.getByLabelText('Message to the assistant')).toBeTruthy();
  });

  it('says chat is unavailable, with the support reference, when the load failed', () => {
    const error = new ApiError({
      code: ErrorCode.InternalError,
      status: 500,
      message: 'down',
      requestId: 'req-8',
    });

    render(<ChatSection {...BASE} conversation={error} />);

    expect(screen.getByRole('note').textContent).toContain('Chat is unavailable');
    expect(screen.getByRole('note').textContent).toContain('req-8');
    expect(screen.queryByLabelText('Message to the assistant')).toBeNull();
  });

  it('says chat is unavailable when no term is chosen', () => {
    render(<ChatSection {...BASE} conversation={null} />);

    expect(screen.getByRole('note').textContent).toContain('Chat is unavailable');
  });
});
