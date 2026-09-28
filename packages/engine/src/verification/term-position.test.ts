/**
 * @file Tests for placing a term code in the tenant's term order by calendar sequence.
 */
import { describe, expect, it } from 'vitest';

import { createTerm, type InstitutionId, type Term, type TermCalendar } from '@caa/domain';
import { SYNTHETIC_TENANTS } from '@caa/test-kit';

import { termPositionOf } from './term-position';

const TENANT_A: InstitutionId = SYNTHETIC_TENANTS.a.id;

/**
 * Builds one term of tenant A. Its dates don't affect term order.
 *
 * @param termCode - The term code.
 * @param sequence - The term's position in the calendar.
 * @param index - Distinguishes term IDs.
 * @returns The term.
 */
function term(termCode: string, sequence: number, index: number): Term {
  return createTerm({
    id: `b0000000-0000-4000-8000-00000000000${String(index)}`,
    tenantId: TENANT_A,
    termCode,
    startsOn: '2026-01-12',
    endsOn: '2026-05-08',
    sequence,
  });
}

/** `2026SU` sorts after `2026FA` as a string, but the calendar puts it first. */
const CALENDAR: TermCalendar = [
  term('2026SP', -10, 1),
  term('2026SU', 0, 2),
  term('2026FA', 40, 3),
];

describe('termPositionOf with a term calendar', () => {
  it.each([
    ['2026SP', -10],
    ['2026SU', 0],
    ['2026FA', 40],
  ])('places %s at its sequence %d, not by its text', (termCode, sequence) => {
    expect(termPositionOf({ termCalendar: CALENDAR }, TENANT_A, termCode)).toBe(sequence);
  });

  it('cannot place a term that is not in the calendar', () => {
    expect(termPositionOf({ termCalendar: CALENDAR }, TENANT_A, '2027SP')).toBeNull();
  });

  it('cannot place any term from an empty calendar', () => {
    expect(termPositionOf({ termCalendar: [] }, TENANT_A, '2026SP')).toBeNull();
  });

  it("cannot place a term from another tenant's calendar", () => {
    expect(termPositionOf({ termCalendar: CALENDAR }, SYNTHETIC_TENANTS.b.id, '2026SP')).toBeNull();
  });

  it('cannot place a term listed twice in a calendar that bypassed the schema', () => {
    const termCalendar: TermCalendar = [term('2026SP', 1, 1), term('2026SP', 2, 2)];

    expect(termPositionOf({ termCalendar }, TENANT_A, '2026SP')).toBeNull();
  });
});

describe('termPositionOf with a term code list (transitional, #122)', () => {
  it('places a term at its index', () => {
    expect(termPositionOf({ termCodesOldestFirst: ['2025FA', '2026SP'] }, TENANT_A, '2026SP')).toBe(
      1,
    );
  });

  it('cannot place a term that is not in the list', () => {
    expect(termPositionOf({ termCodesOldestFirst: ['2025FA'] }, TENANT_A, '2026SP')).toBeNull();
  });
});
