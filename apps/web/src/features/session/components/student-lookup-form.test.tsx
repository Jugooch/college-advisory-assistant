/**
 * @file Tests for the student lookup form's label and error messages.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StudentLookupForm } from './student-lookup-form';

describe('StudentLookupForm', () => {
  it('labels the field and shows no error on first view', () => {
    const html = renderToStaticMarkup(<StudentLookupForm idError={null} />);

    expect(html).toContain('<label for="student-id">Student ID</label>');
    expect(html).toContain('aria-describedby="student-id-hint"');
    expect(html).not.toContain('role="alert"');
  });

  it('asks for an ID when none was given, linked to the field', () => {
    const html = renderToStaticMarkup(<StudentLookupForm idError="missing" />);

    expect(html).toContain('aria-describedby="student-id-hint student-id-error"');
    expect(html).toContain('Enter a student ID.</p>');
  });

  it('shows the expected form when the ID was malformed or repeated', () => {
    const html = renderToStaticMarkup(<StudentLookupForm idError="invalid" />);

    expect(html).toContain(
      'Enter one student ID in the form 30000000-0000-4000-8000-000000000001.</p>',
    );
  });
});
