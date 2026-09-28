/**
 * @file A form that opens a student's overview by internal student ID.
 * @module @caa/web/features/session/components/student-lookup-form
 * @requirement FR-02
 */
import type { ReactElement } from 'react';

/** Props for {@link StudentLookupForm}. */
export interface StudentLookupFormProps {
  /** Why the last submission was rejected: no ID, an ID of the wrong form, or null when fine. */
  readonly idError: 'missing' | 'invalid' | null;
}

/** The message for each rejected submission. */
const ID_ERROR_MESSAGES = {
  missing: 'Enter a student ID.',
  invalid: 'Enter one student ID in the form 30000000-0000-4000-8000-000000000001.',
} as const;

/**
 * Renders the lookup form. It submits with GET, so it works without JavaScript.
 *
 * @param props - The last submission's error.
 * @returns The lookup section.
 */
export function StudentLookupForm({ idError }: StudentLookupFormProps): ReactElement {
  const describedBy = idError !== null ? 'student-id-hint student-id-error' : 'student-id-hint';
  return (
    <section aria-labelledby="lookup-heading">
      <h2 id="lookup-heading">Open a student record</h2>
      <form action="/overview" method="get">
        <label htmlFor="student-id">Student ID</label>
        <input
          id="student-id"
          name="studentId"
          type="text"
          required
          autoComplete="off"
          spellCheck={false}
          aria-describedby={describedBy}
          aria-invalid={idError !== null}
        />
        <p id="student-id-hint">
          The internal student ID. You can open only records your sign-in allows.
        </p>
        {idError === null ? null : (
          <p id="student-id-error" className="field-error" role="alert">
            {ID_ERROR_MESSAGES[idError]}
          </p>
        )}
        <button type="submit">Open overview</button>
      </form>
    </section>
  );
}
