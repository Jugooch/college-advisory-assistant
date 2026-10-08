/**
 * @file The policy search form: a plain GET form, so it works by keyboard and without scripting.
 * @module @caa/web/features/policy-help/components/policy-search-form
 * @requirement FR-16
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { ReactElement } from 'react';

import { POLICY_QUERY_FIELD } from '../utils/policy-query';

/** Props for {@link PolicySearchForm}. */
export interface PolicySearchFormProps {
  /** Internal student ID, kept in the URL so the page stays on the same student. */
  readonly studentId: string;
  /** The text last searched, shown in the field. */
  readonly text: string;
  /** Whether the last text was refused, which links the field to an error message. */
  readonly invalid: boolean;
}

/**
 * A plain GET form, so a search works without scripting and the query stays in the URL where
 * the server page reads it.
 *
 * @param props - The student, the last text, and whether it was refused.
 * @returns The form.
 */
export function PolicySearchForm({
  studentId,
  text,
  invalid,
}: PolicySearchFormProps): ReactElement {
  return (
    <form className="policy-search" method="get" role="search" aria-label="Policy search">
      <input type="hidden" name="studentId" value={studentId} />
      <label htmlFor="policy-search">Search school policies</label>{' '}
      <input
        id="policy-search"
        type="search"
        name={POLICY_QUERY_FIELD}
        defaultValue={text}
        maxLength={200}
        aria-invalid={invalid}
        aria-describedby={invalid ? 'policy-search-error' : undefined}
      />{' '}
      <button type="submit">Search</button>
      {invalid ? (
        <p id="policy-search-error" className="notice notice--problem policy-search__error">
          Enter one search of up to 200 characters.
        </p>
      ) : null}
    </form>
  );
}
