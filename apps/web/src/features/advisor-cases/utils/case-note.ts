/**
 * @file The student's note: its limit, the counter text, and when the counter is announced.
 * @module @caa/web/features/advisor-cases/utils/case-note
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { STUDENT_NOTE_MAX_LENGTH } from '@caa/domain';

/** The longest note the API accepts, in characters. */
export const NOTE_MAX_LENGTH = STUDENT_NOTE_MAX_LENGTH;

/** The count of remaining characters at or below which the counter is announced. */
export const NOTE_WARNING_AT = 50;

/**
 * Describes how much of the note is used, for the visible counter.
 *
 * @param note - The text typed so far.
 * @param maxLength - The field's limit. Defaults to the student's note limit.
 * @returns For example `120 of 500 characters used`.
 */
export function describeNoteCount(note: string, maxLength: number = NOTE_MAX_LENGTH): string {
  return `${String(note.length)} of ${String(maxLength)} characters used`;
}

/**
 * Says when the student is close to or at the limit, for the polite live region. Silent until then,
 * so typing isn't announced character by character.
 *
 * @param note - The text typed so far.
 * @param maxLength - The field's limit. Defaults to the student's note limit.
 * @returns A sentence, or `null` while the note is comfortably under the limit.
 */
export function describeNoteWarning(
  note: string,
  maxLength: number = NOTE_MAX_LENGTH,
): string | null {
  const remaining = maxLength - note.length;
  if (remaining <= 0) {
    return `You’ve reached the ${String(maxLength)}-character limit.`;
  }
  if (remaining > NOTE_WARNING_AT) {
    return null;
  }
  return `${String(remaining)} ${remaining === 1 ? 'character' : 'characters'} left.`;
}

/**
 * Returns whether the note can be sent: the API trims it and needs 1 to the limit.
 *
 * @param note - The text typed so far.
 * @returns `true` when the trimmed note has between 1 and the limit's characters.
 */
export function isNoteSendable(note: string): boolean {
  const length = note.trim().length;
  return length >= 1 && length <= NOTE_MAX_LENGTH;
}
