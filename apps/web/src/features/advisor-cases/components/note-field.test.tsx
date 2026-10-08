/**
 * @file Tests for the note field: the 500-character limit, the visible counter linked to the
 * field, the live warning near the limit, and the error that is linked and shown.
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { createRef, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { NOTE_REQUIRED_MESSAGE, NoteField } from './note-field';

/**
 * Renders the field with local state.
 *
 * @param hasError - Whether the error is shown.
 * @returns The container.
 */
function Harness({ hasError = false }: { readonly hasError?: boolean }) {
  const [value, setValue] = useState('');
  return (
    <NoteField
      label="Your note"
      hint="Say what you need."
      value={value}
      onChange={setValue}
      hasError={hasError}
      fieldRef={createRef<HTMLTextAreaElement>()}
    />
  );
}

describe('NoteField', () => {
  afterEach(cleanup);

  it('labels the textarea and limits it to 500 characters', () => {
    render(<Harness />);

    const field = screen.getByRole('textbox', { name: 'Your note' });
    expect(field.getAttribute('maxlength')).toBe('500');
  });

  it('shows a live count that the field is described by', () => {
    render(<Harness />);
    const field = screen.getByRole('textbox', { name: 'Your note' });

    expect(screen.getByText('0 of 500 characters used')).toBeTruthy();
    fireEvent.change(field, { target: { value: 'Hello' } });

    const count = screen.getByText('5 of 500 characters used');
    expect(field.getAttribute('aria-describedby')?.split(' ')).toContain(count.id);
  });

  it('stays silent while typing, then announces near and at the limit', () => {
    render(<Harness />);
    const field = screen.getByRole('textbox', { name: 'Your note' });
    const region = screen.getByRole('status', { name: 'Note length' });

    fireEvent.change(field, { target: { value: 'x'.repeat(100) } });
    expect(region.textContent).toBe('');
    fireEvent.change(field, { target: { value: 'x'.repeat(460) } });
    expect(region.textContent).toBe('40 characters left.');
    fireEvent.change(field, { target: { value: 'x'.repeat(500) } });
    expect(region.textContent).toBe('You’ve reached the 500-character limit.');
    expect(region.getAttribute('aria-live')).toBe('polite');
  });

  it('shows the error, marks the field invalid, and links the error to it', () => {
    render(<Harness hasError />);
    const field = screen.getByRole('textbox', { name: 'Your note' });

    const error = screen.getByText(NOTE_REQUIRED_MESSAGE);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')?.split(' ')).toContain(error.id);
  });

  it('has no error text and is valid when there is no error', () => {
    render(<Harness />);

    expect(screen.queryByText(NOTE_REQUIRED_MESSAGE)).toBeNull();
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('false');
  });

  it.each([false, true])('has no axe violations (error shown: %s)', async (hasError) => {
    const { container } = render(<Harness hasError={hasError} />);

    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
