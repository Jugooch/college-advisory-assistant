/**
 * @file A form that opens a student's overview by internal student ID.
 * @module @caa/web/features/session/components/student-lookup-form
 * @requirement FR-02
 */
import type { ReactElement } from 'react';

/** Props for {@link StudentLookupForm}. */
export interface StudentLookupFormProps {
  /** Whether the last submission had no student ID. */
  readonly isMissingId: boolean;
}

/**
 * Renders the lookup form. It submits with GET, so it works without JavaScript.
 *
 * @param props - The error flag.
 * @returns The lookup section.
 */
export function StudentLookupForm({ isMissingId }: StudentLookupFormProps): ReactElement {
  const describedBy = isMissingId ? 'student-id-hint student-id-error' : 'student-id-hint';
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
          aria-invalid={isMissingId}
        />
        <p id="student-id-hint">
          The internal student ID. You can open only records your sign-in allows.
        </p>
        {isMissingId ? (
          <p id="student-id-error" className="field-error" role="alert">
            Enter a student ID.
          </p>
        ) : null}
        <button type="submit">Open overview</button>
      </form>
    </section>
  );
}
