/**
 * @file Tests for the synthetic term and term calendar builders.
 */
import { describe, expect, it } from 'vitest';

import { TermCalendarSchema, TermSchema } from '@caa/domain';

import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';
import { buildTerm, buildTermCalendar } from './term.builder';

describe('buildTerm', () => {
  it('defaults to fall 2025 of tenant A at position 1', () => {
    expect(buildTerm()).toEqual({
      id: 'b0000000-0000-4000-8000-000000000001',
      tenantId: '10000000-0000-4000-8000-000000000001',
      termCode: '2025FA',
      startsOn: '2025-08-25',
      endsOn: '2025-12-19',
      sequence: 1,
    });
  });

  it('derives the id and sequence from the seed', () => {
    const term = buildTerm({}, 7);

    expect([term.id, term.sequence]).toEqual(['b0000000-0000-4000-8000-000000000007', 7]);
  });

  it('applies overrides, including a negative sequence', () => {
    expect(buildTerm({ termCode: '2026SU', sequence: -3 })).toMatchObject({
      termCode: '2026SU',
      sequence: -3,
    });
  });

  it('returns a term that passes the domain schema', () => {
    expect(TermSchema.safeParse(buildTerm()).success).toBe(true);
  });

  it('rejects a term that ends before it starts', () => {
    expect(() => buildTerm({ endsOn: '2025-08-24' })).toThrow();
  });
});

describe('buildTermCalendar', () => {
  it('defaults to the four synthetic terms of tenant A with sequences 1 to 4', () => {
    expect(buildTermCalendar()).toEqual([
      {
        id: 'b0000000-0000-4000-8000-000000000001',
        tenantId: '10000000-0000-4000-8000-000000000001',
        termCode: '2025FA',
        startsOn: '2025-08-25',
        endsOn: '2025-12-19',
        sequence: 1,
      },
      {
        id: 'b0000000-0000-4000-8000-000000000002',
        tenantId: '10000000-0000-4000-8000-000000000001',
        termCode: '2026SP',
        startsOn: '2026-01-12',
        endsOn: '2026-05-08',
        sequence: 2,
      },
      {
        id: 'b0000000-0000-4000-8000-000000000003',
        tenantId: '10000000-0000-4000-8000-000000000001',
        termCode: '2026FA',
        startsOn: '2026-08-24',
        endsOn: '2026-12-18',
        sequence: 3,
      },
      {
        id: 'b0000000-0000-4000-8000-000000000004',
        tenantId: '10000000-0000-4000-8000-000000000001',
        termCode: '2027SP',
        startsOn: '2027-01-11',
        endsOn: '2027-05-07',
        sequence: 4,
      },
    ]);
  });

  it('returns deep-equal calendars for the same arguments', () => {
    expect(buildTermCalendar()).toEqual(buildTermCalendar());
  });

  it('builds the given terms in order, with seeds from their positions', () => {
    const calendar = buildTermCalendar([
      { termCode: '2026FA', sequence: -10 },
      { termCode: '2026SU', sequence: -2 },
    ]);

    expect(calendar.map((term) => [term.id, term.termCode, term.sequence])).toEqual([
      ['b0000000-0000-4000-8000-000000000001', '2026FA', -10],
      ['b0000000-0000-4000-8000-000000000002', '2026SU', -2],
    ]);
  });

  it('builds an empty calendar from no terms', () => {
    expect(buildTermCalendar([])).toEqual([]);
  });

  it('returns a calendar that passes the domain schema', () => {
    expect(TermCalendarSchema.safeParse(buildTermCalendar()).success).toBe(true);
  });

  it('rejects terms out of sequence order', () => {
    expect(() =>
      buildTermCalendar([{ sequence: 2 }, { termCode: '2026SP', sequence: 1 }]),
    ).toThrow();
  });

  it('rejects a repeated term code', () => {
    expect(() => buildTermCalendar([{ termCode: '2026SP' }, { termCode: '2026SP' }])).toThrow();
  });

  it('rejects terms from two tenants', () => {
    expect(() =>
      buildTermCalendar([{}, { termCode: '2026SP', tenantId: SYNTHETIC_TENANTS.b.id }]),
    ).toThrow();
  });
});
