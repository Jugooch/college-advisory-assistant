/**
 * @file The student's note as it will be sent, shown inside the preview.
 * @module @caa/web/features/advisor-cases/components/note-preview
 * @requirement FR-12
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

/** Shown in the preview before the student has written a note. */
export const NO_NOTE_YET = 'You haven’t written a note yet.';

/** Props for {@link NotePreview}. */
export interface NotePreviewProps {
  /** The note exactly as it will be sent. */
  readonly note: string;
}

/**
 * Renders the note, keeping the student's line breaks.
 *
 * @param props - The note.
 * @returns The note text or the empty message.
 */
export function NotePreview({ note }: NotePreviewProps): ReactElement {
  return note === '' ? <p>{NO_NOTE_YET}</p> : <p className="note-text">{note}</p>;
}
