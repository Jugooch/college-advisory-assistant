'use client';
/**
 * @file A submit button that stays focusable while an action is sending. It uses `aria-disabled`,
 * never `disabled`, so keyboard focus is not lost mid-action.
 * @module @caa/web/features/advisor-cases/components/review-button
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { ReactElement } from 'react';

/** Props for {@link ReviewButton}. */
export interface ReviewButtonProps {
  readonly label: string;
  /** Whether an action is sending: the click is ignored and the button is marked `aria-disabled`. */
  readonly isPending: boolean;
}

/**
 * Renders the button.
 *
 * @param props - The label and whether an action is sending.
 * @returns The submit button.
 */
export function ReviewButton({ label, isPending }: ReviewButtonProps): ReactElement {
  return (
    <button
      type="submit"
      aria-disabled={isPending}
      onClick={(event) => {
        if (isPending) {
          event.preventDefault();
        }
      }}
    >
      {label}
    </button>
  );
}
