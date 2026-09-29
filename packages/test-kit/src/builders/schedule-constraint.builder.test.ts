/**
 * @file Tests for the synthetic schedule constraint builders.
 */
import { describe, expect, it } from 'vitest';

import { ScheduleConstraintSchema, ScheduleConstraintSetSchema } from '@caa/domain';

import {
  buildAllowedCampuses,
  buildAllowedModalities,
  buildCreditRange,
  buildScheduleConstraintSet,
  buildUnavailableTime,
  HARD_STRENGTH,
} from './schedule-constraint.builder';

describe('HARD_STRENGTH', () => {
  it('is a hard strength with no priority rank', () => {
    expect(HARD_STRENGTH).toEqual({ strength: 'HARD', priorityRank: null });
  });
});

describe('buildUnavailableTime', () => {
  it('defaults to a rank-1 preference for no Fridays, 00:00 to 24:00', () => {
    expect(buildUnavailableTime()).toEqual({
      kind: 'UNAVAILABLE_TIME',
      strength: 'PREFERRED',
      priorityRank: 1,
      weekdays: ['FRIDAY'],
      startTime: '00:00',
      endTime: '24:00',
    });
  });

  it('is hard only when the test spreads HARD_STRENGTH', () => {
    expect(buildUnavailableTime({ ...HARD_STRENGTH })).toMatchObject({
      strength: 'HARD',
      priorityRank: null,
    });
  });

  it('builds "not before 10:00" on every weekday', () => {
    expect(
      buildUnavailableTime({
        weekdays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
        startTime: '00:00',
        endTime: '10:00',
      }),
    ).toMatchObject({ startTime: '00:00', endTime: '10:00' });
  });

  it('returns deep-equal constraints for the same arguments', () => {
    expect(buildUnavailableTime({ priorityRank: 2 })).toEqual(
      buildUnavailableTime({ priorityRank: 2 }),
    );
  });

  it('returns a constraint that passes the domain schema', () => {
    expect(ScheduleConstraintSchema.safeParse(buildUnavailableTime()).success).toBe(true);
  });

  it('rejects a hard strength that keeps a priority rank', () => {
    expect(() => buildUnavailableTime({ strength: 'HARD' })).toThrow();
  });

  it('rejects an inverted block', () => {
    expect(() => buildUnavailableTime({ startTime: '12:00', endTime: '10:00' })).toThrow();
  });
});

describe('buildCreditRange', () => {
  it('defaults to a rank-1 preference for 12.00 to 15.00 credits', () => {
    expect(buildCreditRange()).toEqual({
      kind: 'CREDIT_RANGE',
      strength: 'PREFERRED',
      priorityRank: 1,
      minCreditsHundredths: 1200,
      maxCreditsHundredths: 1500,
    });
  });

  it('accepts a hard maximum with no minimum', () => {
    expect(
      buildCreditRange({ ...HARD_STRENGTH, minCreditsHundredths: null, maxCreditsHundredths: 300 }),
    ).toMatchObject({ strength: 'HARD', minCreditsHundredths: null, maxCreditsHundredths: 300 });
  });

  it('rejects a minimum above the maximum rather than adjusting it', () => {
    expect(() =>
      buildCreditRange({ minCreditsHundredths: 1600, maxCreditsHundredths: 1500 }),
    ).toThrow();
  });

  it('rejects a range with neither bound', () => {
    expect(() =>
      buildCreditRange({ minCreditsHundredths: null, maxCreditsHundredths: null }),
    ).toThrow();
  });
});

describe('buildAllowedModalities', () => {
  it('defaults to a rank-1 preference for in-person sections only', () => {
    expect(buildAllowedModalities()).toEqual({
      kind: 'ALLOWED_MODALITIES',
      strength: 'PREFERRED',
      priorityRank: 1,
      modalities: ['IN_PERSON'],
    });
  });

  it('rejects a repeated modality', () => {
    expect(() => buildAllowedModalities({ modalities: ['HYBRID', 'HYBRID'] })).toThrow();
  });
});

describe('buildAllowedCampuses', () => {
  it('defaults to a rank-1 preference for the north campus only', () => {
    expect(buildAllowedCampuses()).toEqual({
      kind: 'ALLOWED_CAMPUSES',
      strength: 'PREFERRED',
      priorityRank: 1,
      campusIds: ['d0000000-0000-4000-8000-000000000001'],
    });
  });

  it('rejects an empty campus list', () => {
    expect(() => buildAllowedCampuses({ campusIds: [] })).toThrow();
  });
});

describe('buildScheduleConstraintSet', () => {
  it('defaults to an empty set', () => {
    expect(buildScheduleConstraintSet()).toEqual([]);
  });

  it('keeps hard constraints and ranked preferences in the order given', () => {
    const set = buildScheduleConstraintSet([
      buildUnavailableTime({ ...HARD_STRENGTH }),
      buildCreditRange({ priorityRank: 2 }),
      buildAllowedCampuses({ priorityRank: 1 }),
    ]);

    expect(set.map((item) => [item.kind, item.strength, item.priorityRank])).toEqual([
      ['UNAVAILABLE_TIME', 'HARD', null],
      ['CREDIT_RANGE', 'PREFERRED', 2],
      ['ALLOWED_CAMPUSES', 'PREFERRED', 1],
    ]);
  });

  it('returns a set that passes the domain schema', () => {
    expect(
      ScheduleConstraintSetSchema.safeParse(buildScheduleConstraintSet([buildUnavailableTime()]))
        .success,
    ).toBe(true);
  });

  it('rejects two preferences with the same rank', () => {
    expect(() =>
      buildScheduleConstraintSet([buildUnavailableTime(), buildAllowedModalities()]),
    ).toThrow();
  });

  it('rejects two hard credit ranges', () => {
    expect(() =>
      buildScheduleConstraintSet([
        buildCreditRange({ ...HARD_STRENGTH }),
        buildCreditRange({ ...HARD_STRENGTH, minCreditsHundredths: 600 }),
      ]),
    ).toThrow();
  });
});
