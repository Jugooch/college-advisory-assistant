/**
 * @file Tests for the term and campus display data of the schedule-options response
 *   (ADR-0010 Amendment 7): both required, and the campuses must be exactly the ones named.
 */
import { describe, expect, it } from 'vitest';

import {
  buildOption,
  buildResponse,
  bundleOf,
  creditLoadCheck,
  LECTURE_LAB_BUNDLE,
  LECTURE_SECTION,
  MEETING,
  MISSING_SECTIONS,
  NORTH_CAMPUS_ID,
  PHYS_301,
  singleSectionOption,
  TERM_ID,
} from '../testing/schedule-option-fixtures';
import { ScheduleOptionsResponseSchema } from './schedule-options.contract';

const SOUTH_CAMPUS_ID = 'c4a1b2c3-0000-4000-8000-000000000002';
const EAST_CAMPUS_ID = 'c4a1b2c3-0000-4000-8000-000000000003';
const NORTH = { id: NORTH_CAMPUS_ID, name: 'North Campus' };
const SOUTH = { id: SOUTH_CAMPUS_ID, name: 'South Campus' };
const EAST = { id: EAST_CAMPUS_ID, name: 'East Campus' };
const TERM = {
  id: TERM_ID,
  termCode: '2026FA',
  startsOn: '2026-08-24',
  endsOn: '2026-12-11',
};

/**
 * Builds a schedule check whose one issue is a transition between two campuses.
 *
 * @param state - `FAIL` for an insufficient gap, `UNKNOWN` for an undefined pair.
 * @param from - Campus of the earlier meeting.
 * @param to - Campus of the later meeting.
 * @returns A check payload.
 */
function transitionCheck(
  state: 'FAIL' | 'UNKNOWN',
  from: string,
  to: string,
): Record<string, unknown> {
  const meeting = (seed: string, start: string, end: string): Record<string, unknown> => ({
    sectionId: `5ec70000-0000-4000-8000-00000000000${seed}`,
    meetingIndex: 0,
    weekdays: ['MONDAY'],
    startTime: start,
    endTime: end,
  });
  const base = {
    earlier: meeting('1', '09:00', '09:50'),
    later: meeting('2', '10:00', '10:50'),
    sharedDates: { firstDate: '2026-08-24', lastDate: '2026-12-07', weekdays: ['MONDAY'] },
    fromCampusId: from,
    toCampusId: to,
    availableMinutes: 10,
  };
  const issue =
    state === 'FAIL'
      ? { reasonCode: 'TRANSITION_TIME_INSUFFICIENT', ...base, requiredMinutes: 20 }
      : { reasonCode: 'TRANSITION_TIME_UNDEFINED', ...base, requiredMinutes: null };
  return {
    kind: 'SCHEDULE_FEASIBILITY',
    state,
    reasonCode: issue.reasonCode,
    evidence: { rulesetVersion: null, decisiveLeaves: [], scheduleIssues: [issue] },
  };
}

/** A response whose only named campus is the North campus, through a lecture section. */
const NAMES_NORTH = buildResponse({
  options: [buildOption({ rank: 1, bundles: [LECTURE_LAB_BUNDLE] })],
});

const without = (payload: Record<string, unknown>, key: string): unknown =>
  Object.fromEntries(Object.entries(payload).filter(([name]) => name !== key));
const accepts = (payload: unknown): boolean =>
  ScheduleOptionsResponseSchema.safeParse(payload).success;
const messages = (payload: unknown): readonly string[] =>
  ScheduleOptionsResponseSchema.safeParse(payload).error?.issues.map((issue) => issue.message) ??
  [];

describe('ScheduleOptionsResponseSchema term and campuses', () => {
  it('rejects a response without a term', () => {
    expect(accepts(without(buildResponse(), 'term'))).toBe(false);
  });

  it('rejects a response without campuses, even when it names none', () => {
    expect(accepts(without(buildResponse(), 'campuses'))).toBe(false);
  });

  it('accepts a term and exactly the campuses the sections name', () => {
    expect(accepts({ ...NAMES_NORTH, term: TERM, campuses: [NORTH] })).toBe(true);
  });

  it('strips fields beyond id, termCode and dates from the term and campus', () => {
    const parsed = ScheduleOptionsResponseSchema.parse({
      ...NAMES_NORTH,
      term: { ...TERM, tenantId: TERM_ID, sequence: 3 },
      campuses: [{ ...NORTH, tenantId: TERM_ID, sourceCampusId: 'N' }],
    });
    expect(parsed.term).toEqual(TERM);
    expect(parsed.campuses).toEqual([NORTH]);
  });

  it('rejects a response that leaves out a named campus', () => {
    const response = { ...NAMES_NORTH, term: TERM, campuses: [] };
    expect(accepts(response)).toBe(false);
    expect(messages(response)).toContain(
      'campuses must list exactly the campuses the response names, once each, by id',
    );
  });

  it('rejects a campus the response does not name', () => {
    expect(accepts({ ...NAMES_NORTH, campuses: [NORTH, SOUTH] })).toBe(false);
  });

  it('rejects a repeated campus', () => {
    expect(accepts({ ...NAMES_NORTH, campuses: [NORTH, NORTH] })).toBe(false);
  });

  it('rejects campuses that are not ordered by id', () => {
    const conflictSet = {
      items: [transitionCheck('FAIL', SOUTH_CAMPUS_ID, NORTH_CAMPUS_ID)],
      isMinimal: false,
      omittedCount: 0,
    };
    const response = { outcome: 'NO_FEASIBLE_PLAN', options: [], conflictSet };
    expect(accepts(buildResponse({ ...response, campuses: [NORTH, SOUTH] }))).toBe(true);
    expect(accepts(buildResponse({ ...response, campuses: [SOUTH, NORTH] }))).toBe(false);
  });

  it('accepts campuses: [] when the response names no campus', () => {
    const response = buildResponse({
      outcome: 'NEEDS_VERIFICATION',
      searchComplete: false,
      options: [],
      unresolved: [MISSING_SECTIONS],
    });
    expect(accepts({ ...response, term: TERM, campuses: [] })).toBe(true);
    expect(accepts({ ...response, campuses: [NORTH] })).toBe(false);
  });

  it('names both campuses of a transition issue in the conflict set', () => {
    const conflictSet = {
      items: [
        transitionCheck('FAIL', NORTH_CAMPUS_ID, EAST_CAMPUS_ID),
        creditLoadCheck(2000, 'FAIL'),
      ],
      isMinimal: false,
      omittedCount: 0,
    };
    const response = { outcome: 'NO_FEASIBLE_PLAN', options: [], conflictSet };
    expect(accepts(buildResponse({ ...response, campuses: [NORTH, EAST] }))).toBe(true);
    expect(accepts(buildResponse({ ...response, campuses: [NORTH] }))).toBe(false);
    expect(accepts(buildResponse({ ...response, campuses: [] }))).toBe(false);
  });

  it('names both campuses of a transition issue in an option', () => {
    const option = {
      ...singleSectionOption(1, 1, true),
      scheduleFeasibility: transitionCheck('UNKNOWN', SOUTH_CAMPUS_ID, EAST_CAMPUS_ID),
    };
    const response = buildResponse({ options: [option] });
    expect(accepts({ ...response, campuses: [SOUTH, EAST] })).toBe(true);
    expect(accepts({ ...response, campuses: [SOUTH] })).toBe(false);
  });

  it('names the campus of an on-campus meeting location', () => {
    const section = {
      ...LECTURE_SECTION,
      campusId: null,
      meetings: [
        { ...MEETING, location: { kind: 'ON_CAMPUS', campusId: SOUTH_CAMPUS_ID, room: null } },
      ],
    };
    const response = buildResponse({
      options: [buildOption({ rank: 1, bundles: [bundleOf(PHYS_301, [section], 400)] })],
    });
    expect(accepts({ ...response, campuses: [SOUTH] })).toBe(true);
    expect(accepts({ ...response, campuses: [] })).toBe(false);
  });

  it('names the campus of a CampusNotAllowed issue in the conflict set', () => {
    const issue = {
      reasonCode: 'CAMPUS_NOT_ALLOWED',
      sectionId: '5ec70000-0000-4000-8000-000000000001',
      meetingIndex: 0,
      campusId: EAST_CAMPUS_ID,
      constraintIndex: 0,
    };
    const check = {
      kind: 'SCHEDULE_FEASIBILITY',
      state: 'FAIL',
      reasonCode: issue.reasonCode,
      evidence: { rulesetVersion: null, decisiveLeaves: [], scheduleIssues: [issue] },
    };
    const response = buildResponse({
      outcome: 'NO_FEASIBLE_PLAN',
      options: [],
      conflictSet: { items: [check], isMinimal: false, omittedCount: 0 },
    });
    expect(accepts({ ...response, campuses: [EAST] })).toBe(true);
    expect(accepts({ ...response, campuses: [] })).toBe(false);
  });

  it('rejects a term that ends before it starts', () => {
    expect(accepts(buildResponse({ term: { ...TERM, endsOn: '2026-08-01' } }))).toBe(false);
  });

  it('rejects a campus without a name', () => {
    expect(accepts(buildResponse({ campuses: [{ id: NORTH_CAMPUS_ID, name: '' }] }))).toBe(false);
  });
});
