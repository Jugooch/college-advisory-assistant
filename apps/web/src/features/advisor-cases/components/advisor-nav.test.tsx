/**
 * @file Tests for the advisor navigation: a labelled landmark whose queue link is marked current
 * only on the queue.
 */
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AdvisorNav } from './advisor-nav';

describe('AdvisorNav', () => {
  afterEach(cleanup);

  it('marks the queue link current on the queue', () => {
    render(<AdvisorNav isQueueCurrent />);

    const link = screen.getByRole('link', { name: 'Review queue' });
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(link.getAttribute('href')).toBe('/advisor/queue');
    expect(screen.getByRole('navigation', { name: 'Advisor' })).toBeTruthy();
  });

  it('does not mark it current elsewhere', () => {
    render(<AdvisorNav isQueueCurrent={false} />);

    expect(
      screen.getByRole('link', { name: 'Review queue' }).getAttribute('aria-current'),
    ).toBeNull();
  });
});
