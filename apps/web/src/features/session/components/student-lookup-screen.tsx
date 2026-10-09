/**
 * @file A screen's heading above the student lookup form, for a page opened without a valid
 * student ID.
 * @module @caa/web/features/session/components/student-lookup-screen
 * @requirement FR-02
 */
import type { ReactElement } from 'react';

import { StudentLookupForm } from './student-lookup-form';

/** Props for {@link StudentLookupScreen}. */
export interface StudentLookupScreenProps {
  /** The page's `h1`. */
  readonly title: string;
  /** Whether the ID in the URL was present but malformed, rather than missing. */
  readonly isIdInvalid: boolean;
}

/**
 * Renders the page heading and the lookup form.
 *
 * @param props - The heading and whether the ID was malformed.
 * @returns The heading and the form.
 */
export function StudentLookupScreen({
  title,
  isIdInvalid,
}: StudentLookupScreenProps): ReactElement {
  return (
    <>
      <h1>{title}</h1>
      <StudentLookupForm idError={isIdInvalid ? 'invalid' : null} />
    </>
  );
}
