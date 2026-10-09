// @vitest-environment jsdom
/**
 * @file Tests for the starter prompts: fixed wording, one button each, and the choose callback.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_CHAT_INTRO, STARTER_PROMPTS } from '../utils/conversation-wording';
import { StarterPrompts } from './starter-prompts';

afterEach(cleanup);

describe('StarterPrompts', () => {
  it('offers the four fixed questions after one sentence', () => {
    render(<StarterPrompts onChoose={vi.fn()} />);

    expect(screen.getByText(EMPTY_CHAT_INTRO)).toBeTruthy();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      "I'd like no Fridays",
      'Show me my options',
      'What is the policy on dropping a course?',
      'Ask my advisor to review my plan',
    ]);
  });

  it('passes the chosen text to the handler', () => {
    const onChoose = vi.fn();
    render(<StarterPrompts onChoose={onChoose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Show me my options' }));

    expect(onChoose).toHaveBeenCalledWith('Show me my options');
  });

  it('states no academic fact', () => {
    expect(STARTER_PROMPTS.join(' ')).not.toMatch(/\d|eligible|credit|deadline/i);
  });
});
