/**
 * @file Tests for the note limit, the counter text, and when the limit warning is spoken.
 */
import { describe, expect, it } from 'vitest';

import {
  describeNoteCount,
  describeNoteWarning,
  isNoteSendable,
  NOTE_MAX_LENGTH,
  NOTE_WARNING_AT,
} from './case-note';

describe('note limit', () => {
  it('is 500 characters, as the API enforces', () => {
    expect(NOTE_MAX_LENGTH).toBe(500);
  });
});

describe('describeNoteCount', () => {
  it('shows the used count against the limit', () => {
    expect(describeNoteCount('')).toBe('0 of 500 characters used');
    expect(describeNoteCount('abc')).toBe('3 of 500 characters used');
    expect(describeNoteCount('x'.repeat(500))).toBe('500 of 500 characters used');
  });
});

describe('describeNoteWarning', () => {
  it('is silent while the note is comfortably under the limit', () => {
    expect(describeNoteWarning('')).toBeNull();
    expect(describeNoteWarning('x'.repeat(NOTE_MAX_LENGTH - NOTE_WARNING_AT - 1))).toBeNull();
  });

  it('counts down near the limit', () => {
    expect(describeNoteWarning('x'.repeat(NOTE_MAX_LENGTH - NOTE_WARNING_AT))).toBe(
      '50 characters left.',
    );
    expect(describeNoteWarning('x'.repeat(NOTE_MAX_LENGTH - 1))).toBe('1 character left.');
  });

  it('says the limit is reached at 500', () => {
    expect(describeNoteWarning('x'.repeat(NOTE_MAX_LENGTH))).toBe(
      'You’ve reached the 500-character limit.',
    );
  });
});

describe('isNoteSendable', () => {
  it('needs at least one character that is not whitespace', () => {
    expect(isNoteSendable('')).toBe(false);
    expect(isNoteSendable('   \n ')).toBe(false);
    expect(isNoteSendable(' a ')).toBe(true);
  });

  it('allows 500 characters and rejects 501', () => {
    expect(isNoteSendable('x'.repeat(500))).toBe(true);
    expect(isNoteSendable('x'.repeat(501))).toBe(false);
  });
});

describe('a field with its own limit', () => {
  it('counts and warns against the limit it is given', () => {
    expect(describeNoteCount('abc', 1000)).toBe('3 of 1000 characters used');
    expect(describeNoteWarning('a'.repeat(900), 1000)).toBeNull();
    expect(describeNoteWarning('a'.repeat(960), 1000)).toBe('40 characters left.');
    expect(describeNoteWarning('a'.repeat(1000), 1000)).toBe(
      'You’ve reached the 1000-character limit.',
    );
  });
});
