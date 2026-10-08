/**
 * @file Tests for policy help: labelled search form, results states in a live region, plain-text
 * rendering, conflict notice, structured source fields, and the where-to-ask list.
 */
// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';

import { ApiError } from '@caa/api-contract';
import { buildPolicyHit } from '@caa/test-kit';

import { WHERE_TO_ASK_TOPICS } from '../utils/topic-wording';
import { PolicySearchForm } from './policy-search-form';
import { PolicySearchResults } from './policy-search-results';
import { WhereToAsk } from './where-to-ask';

const AS_OF = '2026-10-08T12:00:00.000Z';
const OUTAGE = new ApiError({
  code: 'SOURCE_UNAVAILABLE',
  status: 503,
  message: 'Policy source unavailable.',
  requestId: 'req-1',
});

/**
 * Counts axe violations in the rendered page.
 *
 * @returns The violation count.
 */
async function violations(): Promise<number> {
  return (await axe.run(document.body)).violations.length;
}

describe('PolicySearchForm', () => {
  afterEach(cleanup);

  it('has a labelled search field, a submit button, and keeps the student', async () => {
    const { container } = render(
      <PolicySearchForm studentId="stu-1" text="late drop" invalid={false} />,
    );

    expect(screen.getByRole('search')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Search school policies').value).toBe(
      'late drop',
    );
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
    expect(container.querySelector<HTMLInputElement>('input[name="studentId"]')?.value).toBe(
      'stu-1',
    );
    expect(await violations()).toBe(0);
  });

  it('links the field to its error when the text was refused', () => {
    render(<PolicySearchForm studentId="stu-1" text="" invalid />);

    const field = screen.getByLabelText('Search school policies');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(
      document.getElementById(field.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toContain('200');
  });
});

describe('PolicySearchResults', () => {
  afterEach(cleanup);

  it('keeps an empty polite live region before any search', () => {
    render(<PolicySearchResults text={null} result={null} />);

    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });

  it('shows each hit with its source label, revision, interval, and approval time', async () => {
    const hit = buildPolicyHit({
      title: 'Late drop',
      excerpt: 'Drops after week 4 need approval.',
      sourceLabel: 'Registrar handbook',
      effectiveTo: null,
    });
    render(<PolicySearchResults text="drop" result={{ hits: [hit], asOf: AS_OF }} />);

    const region = screen.getByRole('status');
    expect(within(region).getByRole('heading', { name: 'Late drop' })).toBeTruthy();
    expect(region.textContent).toContain('Drops after week 4 need approval.');
    expect(within(region).getByText('Registrar handbook')).toBeTruthy();
    expect(region.textContent).toContain('with no end date');
    expect(region.querySelectorAll('time').length).toBe(2);
    expect(await violations()).toBe(0);
  });

  it('renders policy text as plain text with no HTML or link', () => {
    const hit = buildPolicyHit({ excerpt: '<a href="https://evil.test">click</a> **bold**' });
    render(<PolicySearchResults text="x" result={{ hits: [hit], asOf: AS_OF }} />);

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain(
      '<a href="https://evil.test">click</a> **bold**',
    );
  });

  it('shows the conflict notice only for a conflicting hit', () => {
    const hits = [
      buildPolicyHit({ documentKey: 'a', conflict: true }),
      buildPolicyHit({ documentKey: 'b', conflict: false }),
    ];
    render(<PolicySearchResults text="x" result={{ hits, asOf: AS_OF }} />);

    expect(screen.getAllByRole('note')).toHaveLength(1);
  });

  it('says nothing approved matched when there are no hits', () => {
    render(<PolicySearchResults text="parking" result={{ hits: [], asOf: AS_OF }} />);

    expect(screen.getByRole('status').textContent).toContain(
      'No approved policy matched “parking”',
    );
  });

  it('shows a source outage as an error, not as no results', () => {
    render(<PolicySearchResults text="parking" result={OUTAGE} />);

    expect(screen.getByRole('status').textContent).toContain('Policy source unavailable.');
    expect(screen.getByRole('status').textContent).not.toContain('No approved policy');
  });
});

describe('WhereToAsk', () => {
  afterEach(cleanup);

  it('lists crisis first with the fixed line, a referral document, or an outage note', async () => {
    const entries = WHERE_TO_ASK_TOPICS.map((topic) => ({
      topic,
      result:
        topic === 'FINANCIAL_AID'
          ? { hits: [buildPolicyHit({ title: 'Aid office', topic })], asOf: AS_OF }
          : topic === 'APPEALS'
            ? OUTAGE
            : { hits: [], asOf: AS_OF },
    }));
    render(<WhereToAsk entries={entries} />);

    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings[0]).toBe('Crisis or urgent personal support');
    expect(screen.getAllByText('Ask your advising office.').length).toBeGreaterThan(3);
    expect(screen.getByRole('heading', { name: 'Aid office' })).toBeTruthy();
    expect(screen.getByText('Unavailable:')).toBeTruthy();
    expect(await violations()).toBe(0);
  });
});
