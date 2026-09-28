/**
 * @file Tests for the term data object and the term calendar.
 */
import { describe, expect, it } from 'vitest';

import {
  createTerm,
  createTermCalendar,
  TermCalendarSchema,
  type TermInput,
  TermSchema,
} from './term.model';

const SPRING: TermInput = {
  id: '92a3b4c5-0000-4000-8000-000000000001',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  termCode: '2026SP',
  startsOn: '2026-01-12',
  endsOn: '2026-05-08',
  sequence: 10,
};

const SUMMER: TermInput = {
  ...SPRING,
  id: '92a3b4c5-0000-4000-8000-000000000002',
  termCode: '2026SU',
  startsOn: '2026-06-01',
  endsOn: '2026-07-31',
  sequence: 20,
};

const FALL: TermInput = {
  ...SPRING,
  id: '92a3b4c5-0000-4000-8000-000000000003',
  termCode: '2026FA',
  startsOn: '2026-08-24',
  endsOn: '2026-12-11',
  sequence: 30,
};

describe('createTerm', () => {
  it('accepts a term with a source code, dates, and a sequence', () => {
    expect(createTerm(SPRING)).toEqual({
      id: '92a3b4c5-0000-4000-8000-000000000001',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      termCode: '2026SP',
      startsOn: '2026-01-12',
      endsOn: '2026-05-08',
      sequence: 10,
    });
  });

  it('accepts a one-day term', () => {
    expect(createTerm({ ...SPRING, endsOn: '2026-01-12' }).endsOn).toBe('2026-01-12');
  });

  it('accepts a negative sequence, because only the order matters', () => {
    expect(createTerm({ ...SPRING, sequence: -5 }).sequence).toBe(-5);
  });

  it('rejects a term that ends before it starts', () => {
    expect(() => createTerm({ ...SPRING, endsOn: '2026-01-11' })).toThrow(
      /startsOn must not be later than endsOn/,
    );
  });

  it('rejects a fractional sequence', () => {
    expect(() => createTerm({ ...SPRING, sequence: 10.5 })).toThrow();
  });

  it('rejects a sequence beyond the safe integer range', () => {
    expect(() => createTerm({ ...SPRING, sequence: Number.MAX_SAFE_INTEGER + 1 })).toThrow();
  });

  it.each(['2026-01-12T00:00:00Z', '2026-13-01', '01/12/2026', ''])(
    'rejects the start date %j',
    (startsOn) => {
      expect(() => createTerm({ ...SPRING, startsOn })).toThrow();
    },
  );

  it('rejects an empty termCode', () => {
    expect(() => createTerm({ ...SPRING, termCode: '' })).toThrow();
  });

  it('rejects a term ID that is not a UUID', () => {
    expect(() => createTerm({ ...SPRING, id: '2026SP' })).toThrow();
  });
});

describe('TermSchema', () => {
  it('reports reversed dates on the endsOn field', () => {
    const result = TermSchema.safeParse({ ...SPRING, startsOn: '2026-05-09' });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['endsOn']]);
  });
});

describe('createTermCalendar', () => {
  it('accepts terms listed oldest first by sequence, whatever their codes sort as', () => {
    // '2026FA' < '2026SP' < '2026SU' as strings; the calendar order is SP, SU, FA.
    expect(createTermCalendar([SPRING, SUMMER, FALL]).map((term) => term.termCode)).toEqual([
      '2026SP',
      '2026SU',
      '2026FA',
    ]);
  });

  it('accepts gaps in the sequence', () => {
    expect(
      createTermCalendar([SPRING, { ...FALL, sequence: 1000 }]).map((term) => term.sequence),
    ).toEqual([10, 1000]);
  });

  it('accepts an empty calendar', () => {
    expect(createTermCalendar([])).toEqual([]);
  });

  it('accepts overlapping terms, because the order comes from sequence alone', () => {
    const session = { ...SUMMER, termCode: '2026S2', startsOn: '2026-07-01', sequence: 25 };

    expect(createTermCalendar([SPRING, SUMMER, session, FALL])).toHaveLength(4);
  });

  it('rejects terms from two tenants', () => {
    expect(() =>
      createTermCalendar([SPRING, { ...FALL, tenantId: '1c9a7b47-4a8f-4b64-8d2f-9a2c3d4e5f60' }]),
    ).toThrow(/must belong to one tenant/);
  });

  it('rejects a repeated termCode', () => {
    expect(() => createTermCalendar([SPRING, { ...FALL, termCode: '2026SP' }])).toThrow(
      /termCode must be unique within a tenant/,
    );
  });

  it('rejects a repeated sequence', () => {
    expect(() => createTermCalendar([SPRING, { ...FALL, sequence: 10 }])).toThrow(
      /strictly increasing sequence/,
    );
  });

  it('rejects terms listed out of sequence order', () => {
    expect(() => createTermCalendar([FALL, SPRING])).toThrow(/strictly increasing sequence/);
  });

  it('rejects a calendar containing an invalid term', () => {
    expect(() => createTermCalendar([{ ...SPRING, endsOn: '2025-12-31' }])).toThrow(
      /startsOn must not be later than endsOn/,
    );
  });
});

describe('TermCalendarSchema', () => {
  it('reports only the ordering issue when sequences are out of order', () => {
    const result = TermCalendarSchema.safeParse([SUMMER, SPRING]);

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'Terms must be listed in strictly increasing sequence',
    ]);
  });
});
