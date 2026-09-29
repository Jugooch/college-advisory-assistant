/**
 * @file Builds synthetic terms and term calendars for tests.
 * @module @caa/test-kit/builders/term
 */
import {
  createTerm,
  createTermCalendar,
  type Term,
  type TermCalendar,
  type TermInput,
} from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';
import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';

/** The code and dates of one synthetic term. */
export type SyntheticTermDates = Pick<TermInput, 'termCode' | 'startsOn' | 'endsOn'>;

/**
 * The synthetic tenant's four terms, oldest first: `2025FA`, `2026SP`, `2026FA`, `2027SP`. The
 * dates are fictional test configuration, not any real institution's calendar.
 */
export const SYNTHETIC_TERMS: readonly SyntheticTermDates[] = [
  { termCode: '2025FA', startsOn: '2025-08-25', endsOn: '2025-12-19' },
  { termCode: '2026SP', startsOn: '2026-01-12', endsOn: '2026-05-08' },
  { termCode: '2026FA', startsOn: '2026-08-24', endsOn: '2026-12-18' },
  { termCode: '2027SP', startsOn: '2027-01-11', endsOn: '2027-05-07' },
];

/**
 * Builds a valid term of tenant A: `2025FA`, 2025-08-25 to 2025-12-19, at position `seed` in the
 * tenant's order.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes terms; drives the default `id` and `sequence`.
 * @returns A validated term.
 */
export function buildTerm(overrides: Partial<TermInput> = {}, seed = 1): Term {
  return createTerm({
    id: syntheticId('term', seed),
    tenantId: SYNTHETIC_TENANTS.a.id,
    termCode: '2025FA',
    startsOn: '2025-08-25',
    endsOn: '2025-12-19',
    sequence: seed,
    ...overrides,
  });
}

/**
 * Builds a valid term calendar, oldest term first. Each entry is passed to {@link buildTerm}
 * with seed `index + 1`, so by default the Nth term has term ID seed N and `sequence` N.
 *
 * @param terms - Overrides for each term, in calendar order. Defaults to
 *   {@link SYNTHETIC_TERMS}, the four terms of tenant A with sequences 1 to 4.
 * @returns A validated term calendar.
 * @throws {z.ZodError} When the terms mix tenants, repeat a code, or aren't in strictly
 *   increasing `sequence`.
 */
export function buildTermCalendar(
  terms: readonly Partial<TermInput>[] = SYNTHETIC_TERMS,
): TermCalendar {
  return createTermCalendar(terms.map((overrides, index) => buildTerm(overrides, index + 1)));
}
