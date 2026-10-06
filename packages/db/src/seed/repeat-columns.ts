/**
 * @file Flattens a course's repeat statement into the course table's repeat columns.
 * @module @caa/db/seed/repeat-columns
 * @requirement FR-06
 */

/** A course's repeat statement as the domain holds it. A missing value means not repeatable. */
export type RepeatStatement =
  | { readonly maxAttempts: number | null; readonly maxCreditsHundredths: number | null }
  | null
  | undefined;

/** The repeat columns of the course table. */
export interface RepeatColumns {
  readonly repeatableForCredit: boolean;
  readonly repeatMaxAttempts: number | null;
  readonly repeatMaxCreditsHundredths: number | null;
}

/**
 * Flattens a repeat statement into the repeat columns.
 *
 * @param statement - The course's repeat statement; null or missing means not repeatable.
 * @returns The repeat flag and caps, with no caps when the course is not repeatable.
 */
export function toRepeatColumns(statement: RepeatStatement): RepeatColumns {
  if (!statement) {
    return {
      repeatableForCredit: false,
      repeatMaxAttempts: null,
      repeatMaxCreditsHundredths: null,
    };
  }
  return {
    repeatableForCredit: true,
    repeatMaxAttempts: statement.maxAttempts,
    repeatMaxCreditsHundredths: statement.maxCreditsHundredths,
  };
}
