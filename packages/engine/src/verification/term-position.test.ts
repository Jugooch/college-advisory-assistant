/**
 * @file Tests for placing a term code in the tenant's term order by calendar sequence.
 */
import { describe, expect, it } from 'vitest';

import type { InstitutionId, TermCalendar } from '@caa/domain';
import { buildTerm, buildTermCalendar, SYNTHETIC_TENANTS } from '@caa/test-kit';

import { termPositionOf } from './term-position';

const TENANT_A: InstitutionId = SYNTHETIC_TENANTS.a.id;

/** `2026SU` sorts after `2026FA` as a string, but the calendar puts it first. */
const CALENDAR: TermCalendar = buildTermCalendar([
  { termCode: '2026SP', sequence: -10 },
  { termCode: '2026SU', sequence: 0 },
  { termCode: '2026FA', sequence: 40 },
]);

describe('termPositionOf with a term calendar', () => {
  it.each([
    ['2026SP', -10],
    ['2026SU', 0],
    ['2026FA', 40],
  ])('places %s at its sequence %d, not by its text', (termCode, sequence) => {
    expect(termPositionOf(CALENDAR, TENANT_A, termCode)).toBe(sequence);
  });

  it('cannot place a term that is not in the calendar', () => {
    expect(termPositionOf(CALENDAR, TENANT_A, '2027SP')).toBeNull();
  });

  it('cannot place any term from an empty calendar', () => {
    expect(termPositionOf([], TENANT_A, '2026SP')).toBeNull();
  });

  it("cannot place a term from another tenant's calendar", () => {
    expect(termPositionOf(CALENDAR, SYNTHETIC_TENANTS.b.id, '2026SP')).toBeNull();
  });

  it('cannot place a term listed twice in a calendar that bypassed the schema', () => {
    const termCalendar: TermCalendar = [
      buildTerm({ termCode: '2026SP' }, 1),
      buildTerm({ termCode: '2026SP' }, 2),
    ];

    expect(termPositionOf(termCalendar, TENANT_A, '2026SP')).toBeNull();
  });
});
