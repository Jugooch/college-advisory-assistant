/**
 * @file Tests for the revision history: every revision is a link, revision 1 stays visible, the
 * revision on screen is marked in text, and axe.
 */
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';

import { buildPlanRevisionView, buildPlanView } from '@caa/test-kit';

import { RevisionHistory } from './revision-history';

const PLAN = buildPlanView({
  latest: buildPlanRevisionView({ revision: 3, cause: 'REVALIDATED' }),
});

/**
 * Renders the history.
 *
 * @param shownRevision - The revision on screen.
 * @returns The container.
 */
function renderHistory(shownRevision: number) {
  return render(
    <RevisionHistory
      revisions={PLAN.revisions}
      shownRevision={shownRevision}
      revisionHref={(revision) => `/my-plans/p?revision=${String(revision)}`}
    />,
  ).container;
}

describe('RevisionHistory', () => {
  afterEach(cleanup);

  it('lists every revision newest first as keyboard-operable links, revision 1 included', () => {
    renderHistory(3);

    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Revision 3',
      'Revision 2',
      'Revision 1',
    ]);
    expect(links[2]?.getAttribute('href')).toBe('/my-plans/p?revision=1');
  });

  it('marks the latest and the one showing in text, and aria-current on the link', () => {
    const container = renderHistory(2);

    const items = [...container.querySelectorAll('li')].map((li) => li.textContent);
    expect(items[0]).toContain('Latest');
    expect(items[1]).toContain('Showing now');
    expect(items[2]).not.toContain('Showing now');
    expect(screen.getByRole('link', { name: 'Revision 2' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(
      screen.getByRole('link', { name: 'Revision 1' }).getAttribute('aria-current'),
    ).toBeNull();
  });

  it('names each cause and shows the original time', () => {
    const container = renderHistory(3);

    expect(container.textContent).toContain('Revalidation');
    expect(container.textContent).toContain('Saved');
    expect(container.querySelectorAll('time')).toHaveLength(3);
    expect(container.textContent).not.toMatch(/validated/i);
  });

  it('is a labeled navigation with no axe violations', async () => {
    const container = renderHistory(3);

    expect(screen.getByRole('navigation', { name: 'Revision history' })).toBeTruthy();
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
