/**
 * @file Tests for the term row mapper.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import type { TermRow } from '../tables/term.table';
import { toTerm } from './term.mapper';

const ROW: TermRow = {
  id: '92a3b4c5-d6e7-4f80-9192-a3b4c5d6e7f8',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  termCode: '2026FA',
  startsOn: '2026-08-24',
  endsOn: '2026-12-18',
  sequence: 20263,
  createdAt: new Date('2026-09-25T12:00:00.000Z'),
};

describe('toTerm', () => {
  it('keeps the term dates as calendar date strings', () => {
    const term = toTerm(ROW);

    expect(term).toEqual({
      id: '92a3b4c5-d6e7-4f80-9192-a3b4c5d6e7f8',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      termCode: '2026FA',
      startsOn: '2026-08-24',
      endsOn: '2026-12-18',
      sequence: 20263,
    });
  });

  it('rejects a stored term that ends before it starts', () => {
    expect(() => toTerm({ ...ROW, endsOn: '2026-08-23' })).toThrow(ZodError);
  });
});
