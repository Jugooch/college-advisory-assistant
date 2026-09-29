/**
 * @file Tests for schedule constraints and constraint sets.
 */
import { describe, expect, it } from 'vitest';

import {
  createScheduleConstraint,
  createScheduleConstraintSet,
  type ScheduleConstraintInput,
  ScheduleConstraintSchema,
} from './schedule-constraint.model';

const NORTH_CAMPUS_ID = 'c4a1b2c3-0000-4000-8000-000000000001';

const NO_FRIDAYS: ScheduleConstraintInput = {
  kind: 'UNAVAILABLE_TIME',
  strength: 'HARD',
  priorityRank: null,
  weekdays: ['FRIDAY'],
  startTime: '00:00',
  endTime: '24:00',
};

const NOT_BEFORE_TEN: ScheduleConstraintInput = {
  kind: 'UNAVAILABLE_TIME',
  strength: 'PREFERRED',
  priorityRank: 1,
  weekdays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
  startTime: '00:00',
  endTime: '10:00',
};

const TWELVE_TO_FIFTEEN: ScheduleConstraintInput = {
  kind: 'CREDIT_RANGE',
  strength: 'HARD',
  priorityRank: null,
  minCreditsHundredths: 1200,
  maxCreditsHundredths: 1500,
};

const IN_PERSON_ONLY: ScheduleConstraintInput = {
  kind: 'ALLOWED_MODALITIES',
  strength: 'PREFERRED',
  priorityRank: 2,
  modalities: ['IN_PERSON', 'HYBRID'],
};

const NORTH_ONLY: ScheduleConstraintInput = {
  kind: 'ALLOWED_CAMPUSES',
  strength: 'HARD',
  priorityRank: null,
  campusIds: [NORTH_CAMPUS_ID],
};

describe('createScheduleConstraint', () => {
  it('accepts a hard "no Fridays" block that runs to the end of the day', () => {
    expect(createScheduleConstraint(NO_FRIDAYS)).toEqual({
      kind: 'UNAVAILABLE_TIME',
      strength: 'HARD',
      priorityRank: null,
      weekdays: ['FRIDAY'],
      startTime: '00:00',
      endTime: '24:00',
    });
  });

  it('accepts a ranked "not before 10:00" preference', () => {
    expect(createScheduleConstraint(NOT_BEFORE_TEN)).toMatchObject({ priorityRank: 1 });
  });

  it('accepts a credit range, and a range with only one bound', () => {
    expect(createScheduleConstraint(TWELVE_TO_FIFTEEN)).toMatchObject({
      minCreditsHundredths: 1200,
      maxCreditsHundredths: 1500,
    });
    expect(
      createScheduleConstraint({ ...TWELVE_TO_FIFTEEN, minCreditsHundredths: null }),
    ).toMatchObject({ minCreditsHundredths: null, maxCreditsHundredths: 1500 });
  });

  it('accepts a credit range whose bounds are equal', () => {
    const exact = { ...TWELVE_TO_FIFTEEN, maxCreditsHundredths: 1200 };

    expect(createScheduleConstraint(exact)).toMatchObject({ maxCreditsHundredths: 1200 });
  });

  it('accepts allowed modalities and allowed campuses', () => {
    expect(createScheduleConstraint(IN_PERSON_ONLY)).toMatchObject({
      modalities: ['IN_PERSON', 'HYBRID'],
    });
    expect(createScheduleConstraint(NORTH_ONLY)).toMatchObject({ campusIds: [NORTH_CAMPUS_ID] });
  });

  it('rejects a hard credit minimum above the hard maximum', () => {
    expect(() =>
      createScheduleConstraint({ ...TWELVE_TO_FIFTEEN, minCreditsHundredths: 1600 }),
    ).toThrow(/minCreditsHundredths must not exceed maxCreditsHundredths/);
  });

  it('rejects a credit range with no bound', () => {
    expect(() =>
      createScheduleConstraint({
        ...TWELVE_TO_FIFTEEN,
        minCreditsHundredths: null,
        maxCreditsHundredths: null,
      }),
    ).toThrow(/needs a minimum, a maximum, or both/);
  });

  it('rejects fractional credits', () => {
    expect(() =>
      createScheduleConstraint({ ...TWELVE_TO_FIFTEEN, maxCreditsHundredths: 1500.5 }),
    ).toThrow();
  });

  it.each([
    { startTime: '10:00', endTime: '09:00' },
    { startTime: '10:00', endTime: '10:00' },
  ])('rejects the inverted or empty block %j', (times) => {
    expect(() => createScheduleConstraint({ ...NOT_BEFORE_TEN, ...times })).toThrow(
      /startTime must be earlier than endTime/,
    );
  });

  it.each(['24:01', '25:00', '9:00'])('rejects the end time %j', (endTime) => {
    expect(() => createScheduleConstraint({ ...NOT_BEFORE_TEN, endTime })).toThrow();
  });

  it('rejects an empty or repeated weekday list', () => {
    expect(() => createScheduleConstraint({ ...NO_FRIDAYS, weekdays: [] })).toThrow();
    expect(() =>
      createScheduleConstraint({ ...NO_FRIDAYS, weekdays: ['FRIDAY', 'FRIDAY'] }),
    ).toThrow(/weekdays must not repeat a day/);
  });

  it('rejects an empty or repeated modality or campus list', () => {
    expect(() => createScheduleConstraint({ ...IN_PERSON_ONLY, modalities: [] })).toThrow();
    expect(() =>
      createScheduleConstraint({ ...IN_PERSON_ONLY, modalities: ['HYBRID', 'HYBRID'] }),
    ).toThrow(/modalities must not repeat/);
    expect(() =>
      createScheduleConstraint({ ...NORTH_ONLY, campusIds: [NORTH_CAMPUS_ID, NORTH_CAMPUS_ID] }),
    ).toThrow(/campusIds must not repeat/);
  });

  it('rejects a hard constraint with a rank, and a preference without one', () => {
    expect(() => createScheduleConstraint({ ...NO_FRIDAYS, priorityRank: 1 })).toThrow(
      /A HARD constraint has no priorityRank/,
    );
    expect(() => createScheduleConstraint({ ...NOT_BEFORE_TEN, priorityRank: null })).toThrow(
      /A HARD constraint has no priorityRank/,
    );
  });

  it('rejects a rank below 1', () => {
    expect(() => createScheduleConstraint({ ...NOT_BEFORE_TEN, priorityRank: 0 })).toThrow();
  });
});

describe('ScheduleConstraintSchema', () => {
  it('rejects an unknown kind or strength', () => {
    expect(ScheduleConstraintSchema.safeParse({ ...NO_FRIDAYS, kind: 'NO_LABS' }).success).toBe(
      false,
    );
    expect(ScheduleConstraintSchema.safeParse({ ...NO_FRIDAYS, strength: 'SOFT' }).success).toBe(
      false,
    );
  });

  it('reports an inverted credit range on minCreditsHundredths', () => {
    const result = ScheduleConstraintSchema.safeParse({
      ...TWELVE_TO_FIFTEEN,
      minCreditsHundredths: 1800,
    });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['minCreditsHundredths']]);
  });
});

describe('createScheduleConstraintSet', () => {
  it('accepts hard constraints and ranked preferences together, in stated order', () => {
    const set = createScheduleConstraintSet([
      NO_FRIDAYS,
      NOT_BEFORE_TEN,
      TWELVE_TO_FIFTEEN,
      IN_PERSON_ONLY,
      NORTH_ONLY,
    ]);

    expect(set.map((constraint) => constraint.kind)).toEqual([
      'UNAVAILABLE_TIME',
      'UNAVAILABLE_TIME',
      'CREDIT_RANGE',
      'ALLOWED_MODALITIES',
      'ALLOWED_CAMPUSES',
    ]);
  });

  it('accepts an empty set', () => {
    expect(createScheduleConstraintSet([])).toEqual([]);
  });

  it('accepts one hard and one preferred credit range', () => {
    const preferred = { ...TWELVE_TO_FIFTEEN, strength: 'PREFERRED', priorityRank: 3 } as const;

    expect(createScheduleConstraintSet([TWELVE_TO_FIFTEEN, preferred])).toHaveLength(2);
  });

  it('accepts several unavailable-time blocks of one strength', () => {
    const mondays = { ...NO_FRIDAYS, weekdays: ['MONDAY'] } as const;

    expect(createScheduleConstraintSet([NO_FRIDAYS, mondays])).toHaveLength(2);
  });

  it('rejects two preferences with the same rank', () => {
    expect(() =>
      createScheduleConstraintSet([NOT_BEFORE_TEN, { ...IN_PERSON_ONLY, priorityRank: 1 }]),
    ).toThrow(/Each preference must have a different priorityRank/);
  });

  it('rejects two hard credit ranges', () => {
    const other = { ...TWELVE_TO_FIFTEEN, minCreditsHundredths: 1600, maxCreditsHundredths: 1800 };

    expect(() => createScheduleConstraintSet([TWELVE_TO_FIFTEEN, other])).toThrow(
      /at most one CREDIT_RANGE/,
    );
  });

  it('rejects two hard campus lists', () => {
    expect(() => createScheduleConstraintSet([NORTH_ONLY, NORTH_ONLY])).toThrow(
      /at most one CREDIT_RANGE, ALLOWED_MODALITIES, and ALLOWED_CAMPUSES/,
    );
  });

  it('rejects a set with an invalid constraint', () => {
    expect(() =>
      createScheduleConstraintSet([{ ...TWELVE_TO_FIFTEEN, minCreditsHundredths: 1600 }]),
    ).toThrow(/minCreditsHundredths must not exceed maxCreditsHundredths/);
  });

  it('rejects more than 32 constraints', () => {
    const blocks = Array.from({ length: 33 }, () => NO_FRIDAYS);

    expect(() => createScheduleConstraintSet(blocks)).toThrow();
    expect(createScheduleConstraintSet(blocks.slice(0, 32))).toHaveLength(32);
  });
});
