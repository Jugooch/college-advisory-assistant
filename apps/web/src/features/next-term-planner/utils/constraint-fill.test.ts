/**
 * @file Proves a filled query reads back as the same constraint through the planner's own parser.
 * @module @caa/web/features/next-term-planner/utils/constraint-fill.test
 * @requirement FR-08
 */
import { describe, expect, it } from 'vitest';

import { type ScheduleConstraint, Weekday } from '@caa/domain';
import {
  buildAllowedCampuses,
  buildAllowedModalities,
  buildCreditRange,
  buildUnavailableTime,
  HARD_STRENGTH,
  syntheticId,
} from '@caa/test-kit';

import { fillPlannerQuery } from '@/shared/utils/constraint-fill';

import { planScheduleRequest } from './planner-plan';
import { readPlannerQuery } from './planner-query';

/**
 * Reads a query through the planner's own parser and returns the constraints it yields.
 *
 * @param params - The filled query.
 * @returns The parsed constraints.
 */
function readBack(params: URLSearchParams): readonly ScheduleConstraint[] {
  const query: Record<string, string[]> = {};
  params.forEach((value, key) => {
    (query[key] ??= []).push(value);
  });
  return planScheduleRequest(readPlannerQuery(query).values, new Map()).constraints;
}

const TERM_ID = syntheticId('term', 1);
const BASE = new URLSearchParams({
  studentId: syntheticId('student', 1),
  term: TERM_ID,
  course: syntheticId('course', 1),
  step: 'review',
});

describe('fillPlannerQuery', () => {
  it('fills an unavailable time and returns to the form step', () => {
    const constraint = buildUnavailableTime({ priorityRank: 2 });
    const result = fillPlannerQuery(BASE, constraint);
    expect(result.kind).toBe('filled');
    if (result.kind === 'filled') {
      expect(result.params.get('step')).toBe('edit');
      expect(result.params.get('term')).toBe(TERM_ID);
      expect(readBack(result.params)).toEqual([constraint]);
    }
  });

  it('fills a hard modality limit as hard', () => {
    const constraint = buildAllowedModalities({ ...HARD_STRENGTH });
    const result = fillPlannerQuery(BASE, constraint);
    expect(result.kind === 'filled' && readBack(result.params)).toEqual([constraint]);
  });

  it('fills a credit range and a campus list', () => {
    const range = buildCreditRange({ minCreditsHundredths: 1250, maxCreditsHundredths: null });
    const first = fillPlannerQuery(BASE, range);
    expect(first.kind === 'filled' && readBack(first.params)).toEqual([range]);
    const campus = buildAllowedCampuses();
    const second = fillPlannerQuery(BASE, campus);
    expect(second.kind === 'filled' && readBack(second.params)).toEqual([campus]);
  });

  it('refuses to overwrite a slot the student already filled', () => {
    const used = new URLSearchParams(BASE);
    used.set('credit-range-max', '15');
    expect(fillPlannerQuery(used, buildCreditRange()).kind).toBe('blocked');
  });

  it('uses the next free time block and blocks when all three are used', () => {
    const days = [Weekday.Monday, Weekday.Tuesday, Weekday.Wednesday];
    let params = BASE;
    for (const day of days) {
      const result = fillPlannerQuery(params, buildUnavailableTime({ weekdays: [day] }));
      expect(result.kind).toBe('filled');
      params = result.kind === 'filled' ? result.params : params;
    }
    expect(params.getAll('block3-day')).toEqual([Weekday.Wednesday]);
    expect(fillPlannerQuery(params, buildUnavailableTime()).kind).toBe('blocked');
  });
});
