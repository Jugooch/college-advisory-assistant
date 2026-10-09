/**
 * @file Tests the not-found page's links and its neutral wording.
 * @module @caa/web/shared/components/not-found-page.test
 */
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';

import NotFound from '@/app/not-found';

describe('NotFound', () => {
  afterEach(cleanup);

  it('links to Overview and Help and cases', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to Overview' }).getAttribute('href')).toBe(
      '/overview',
    );
    expect(screen.getByRole('link', { name: 'Go to Help and cases' }).getAttribute('href')).toBe(
      '/help-and-cases',
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<NotFound />);
    expect((await axe.run(container)).violations).toEqual([]);
  });

  it('does not say whether the item exists for someone else', () => {
    const { container } = render(<NotFound />);
    expect(container.textContent).not.toMatch(/exist|another|someone|permission|access/i);
  });
});
