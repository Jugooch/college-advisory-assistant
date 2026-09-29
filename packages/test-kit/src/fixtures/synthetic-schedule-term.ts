/**
 * @file The fixed synthetic term that section, meeting and section snapshot builders schedule in.
 * @module @caa/test-kit/fixtures/synthetic-schedule-term
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { syntheticId } from './synthetic-id';
import { SYNTHETIC_TENANTS } from './synthetic-tenants';

/** The start and end of a part of the term, `YYYY-MM-DD` in the institution's calendar. */
export interface SyntheticDateRange {
  readonly startsOn: string;
  readonly endsOn: string;
}

/** Which half of the term a half-term meeting or section runs in. */
export type SyntheticTermHalf = 'first' | 'second';

/** The term that section builders schedule in, with its halves. */
export interface SyntheticScheduleTerm extends SyntheticDateRange {
  readonly termId: string;
  readonly termCode: string;
  /** IANA time zone that meeting times are local to. */
  readonly timezone: string;
  readonly halves: Readonly<Record<SyntheticTermHalf, SyntheticDateRange>>;
  /** The local date the clocks move forward, a Sunday, with no meetings by default. */
  readonly daylightSavingStartsOn: string;
}

/**
 * The term section builders schedule in: tenant A's spring 2027 (`2027SP`), the "next term" of
 * the synthetic record. It is term seed 4, the fourth entry of `SYNTHETIC_TERMS`, so it matches
 * `buildTermCalendar()`. All dates are fictional test configuration.
 *
 * - Term: Monday 2027-01-11 to Friday 2027-05-07, local to `America/Chicago` (tenant A).
 * - First half: Monday 2027-01-11 to Friday 2027-03-05.
 * - Second half: Monday 2027-03-08 to Friday 2027-05-07. The halves share no date (AC07).
 * - The US daylight-saving change is Sunday 2027-03-14, inside the second half, so a meeting
 *   that spans it keeps its local wall-clock times across a UTC offset change.
 */
export const SYNTHETIC_SCHEDULE_TERM: SyntheticScheduleTerm = {
  termId: syntheticId('term', 4),
  termCode: '2027SP',
  startsOn: '2027-01-11',
  endsOn: '2027-05-07',
  timezone: SYNTHETIC_TENANTS.a.timezone,
  halves: {
    first: { startsOn: '2027-01-11', endsOn: '2027-03-05' },
    second: { startsOn: '2027-03-08', endsOn: '2027-05-07' },
  },
  daylightSavingStartsOn: '2027-03-14',
};
