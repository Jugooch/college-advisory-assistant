/**
 * @file Tests for the advisor notice: heading, explanation, next step, and a link out, all
 * rendered, with no axe violations.
 */
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';

import {
  NO_ACCESS_EXPLANATION,
  NO_ACCESS_HEADING,
  NO_ACCESS_NEXT_STEP,
} from '../utils/review-wording';
import { AdvisorNotice } from './advisor-notice';

describe('AdvisorNotice', () => {
  afterEach(cleanup);

  it('renders the heading, the explanation, the next step, and the link', async () => {
    const { container } = render(
      <AdvisorNotice
        heading={NO_ACCESS_HEADING}
        explanation={NO_ACCESS_EXPLANATION}
        nextStep={NO_ACCESS_NEXT_STEP}
        href="/advisor/queue"
        linkLabel="Back to the review queue"
      />,
    );

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'You no longer have access to this student',
    );
    expect(container.textContent).toContain(NO_ACCESS_EXPLANATION);
    expect(container.textContent).toContain(NO_ACCESS_NEXT_STEP);
    expect(
      screen.getByRole('link', { name: 'Back to the review queue' }).getAttribute('href'),
    ).toBe('/advisor/queue');
    expect((await axe.run(container)).violations.map((violation) => violation.id)).toEqual([]);
  });
});
