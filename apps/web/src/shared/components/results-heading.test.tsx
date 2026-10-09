/**
 * @file Tests for the results heading: focus on load by default, and no focus or tabindex when a
 * saved result opts out.
 */
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ResultsHeading } from './results-heading';

describe('ResultsHeading', () => {
  afterEach(cleanup);

  it('moves focus to the default heading on load', () => {
    render(<ResultsHeading id="h" />);

    const heading = screen.getByRole('heading', { name: 'Schedule search results' });
    expect(document.activeElement).toBe(heading);
  });

  it('shows custom text without taking focus when told not to', () => {
    render(<ResultsHeading id="h" text="Saved result, as of then" isFocused={false} />);

    const heading = screen.getByRole('heading', { name: 'Saved result, as of then' });
    expect(document.activeElement).not.toBe(heading);
    expect(heading.hasAttribute('tabindex')).toBe(false);
  });

  it('renders at the level it is given, with the given id', () => {
    render(<ResultsHeading id="mine" headingLevel={3} />);

    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading.id).toBe('mine');
  });
});
