// @vitest-environment jsdom
/**
 * @file Tests for the lookup screen: one page heading above the form.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { StudentLookupScreen } from './student-lookup-screen';

describe('StudentLookupScreen', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the page heading and the lookup form', () => {
    render(<StudentLookupScreen title="Plan next term" isIdInvalid={false} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Plan next term');
    expect(screen.getByLabelText('Student ID')).toBeTruthy();
  });

  it('explains a malformed ID', () => {
    render(<StudentLookupScreen title="Plan next term" isIdInvalid />);

    expect(screen.getByText(/Enter one student ID in the form/)).toBeTruthy();
  });
});
