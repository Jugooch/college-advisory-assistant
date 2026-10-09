/**
 * @file Tests for filling a confirmed constraint into the planner form's query.
 */
import { describe, expect, it } from 'vitest';

import { Weekday } from '@caa/domain';
import {
  buildAllowedCampuses,
  buildAllowedModalities,
  buildCreditRange,
  buildUnavailableTime,
  HARD_STRENGTH,
  syntheticId,
} from '@caa/test-kit';

import {
  CAMPUS_SLOT,
  CREDIT_RANGE_SLOT,
  PlannerStep,
  slotFieldName,
  SlotPart,
  STEP_FIELD,
} from '@/shared/utils/planner-query-names';

import { fillPlannerQuery } from './planner-fill';

const TERM_ID = syntheticId('term', 1);
const BASE = new URLSearchParams({
  studentId: syntheticId('student', 1),
  term: TERM_ID,
  course: syntheticId('course', 1),
  step: 'review',
});

/**
 * Fills and returns the new query, failing the test when the fill did not happen.
 *
 * @param params - The current query.
 * @param constraint - The constraint to fill.
 * @returns The new query.
 */
function filled(
  params: URLSearchParams,
  constraint: Parameters<typeof fillPlannerQuery>[1],
): URLSearchParams {
  const result = fillPlannerQuery(params, constraint);
  if (result.kind !== 'filled') {
    throw new Error(`expected a fill, got ${result.kind}`);
  }
  return result.params;
}

describe('fillPlannerQuery', () => {
  it('fills an unavailable time in the form field names and returns to the form step', () => {
    const params = filled(BASE, buildUnavailableTime({ priorityRank: 2 }));
    expect(params.get('step')).toBe('edit');
    expect(params.get('term')).toBe(TERM_ID);
    expect(params.getAll(slotFieldName('block1', 'day'))).toEqual([Weekday.Friday]);
    expect(params.get(slotFieldName('block1', 'strength'))).toBe('PREFERRED');
    expect(params.get(slotFieldName('block1', 'rank'))).toBe('2');
    expect(params.has(slotFieldName('block1', 'start'))).toBe(false);
  });

  it('fills a hard modality limit as hard', () => {
    const params = filled(BASE, buildAllowedModalities({ ...HARD_STRENGTH }));
    expect(params.get('modality-strength')).toBe('HARD');
    expect(params.getAll('modality').length).toBeGreaterThan(0);
  });

  it('fills a credit range and a campus list', () => {
    const range = filled(
      BASE,
      buildCreditRange({ minCreditsHundredths: 1250, maxCreditsHundredths: null }),
    );
    expect(range.get('credit-range-min')).toBe('12.5');
    expect(range.get('credit-range-max')).toBe('');
    expect(filled(BASE, buildAllowedCampuses()).get('campus')).not.toBe('');
  });

  it('refuses to overwrite a slot the student already filled', () => {
    const used = new URLSearchParams(BASE);
    used.set('credit-range-max', '15');
    expect(fillPlannerQuery(used, buildCreditRange()).kind).toBe('blocked');
  });

  it('uses the next free time block and blocks when all three are used', () => {
    let params = BASE;
    for (const day of [Weekday.Monday, Weekday.Tuesday, Weekday.Wednesday]) {
      params = filled(params, buildUnavailableTime({ weekdays: [day] }));
    }
    expect(params.getAll('block3-day')).toEqual([Weekday.Wednesday]);
    expect(fillPlannerQuery(params, buildUnavailableTime()).kind).toBe('blocked');
  });

  it('puts a Friday block in the second slot when the first holds another day', () => {
    const used = new URLSearchParams(BASE);
    used.append('block1-day', Weekday.Monday);
    const params = filled(used, buildUnavailableTime());
    expect(params.getAll('block1-day')).toEqual([Weekday.Monday]);
    expect(params.getAll('block2-day')).toEqual([Weekday.Friday]);
  });

  it('reports a constraint the form already holds instead of adding it twice', () => {
    const once = filled(BASE, buildUnavailableTime());
    expect(fillPlannerQuery(once, buildUnavailableTime()).kind).toBe('present');
    const range = filled(BASE, buildCreditRange());
    expect(fillPlannerQuery(range, buildCreditRange()).kind).toBe('present');
    expect(fillPlannerQuery(BASE, buildCreditRange()).kind).toBe('filled');
  });

  it('builds every field name and the step from the planner shared names', () => {
    const params = filled(BASE, buildCreditRange());
    expect(params.get(STEP_FIELD)).toBe(PlannerStep.Edit);
    expect(params.has(slotFieldName(CREDIT_RANGE_SLOT, SlotPart.Min))).toBe(true);
    expect(params.has(slotFieldName(CREDIT_RANGE_SLOT, SlotPart.Max))).toBe(true);
    expect(params.has(slotFieldName(CREDIT_RANGE_SLOT, SlotPart.Strength))).toBe(true);
    const campus = filled(BASE, buildAllowedCampuses());
    expect(campus.has(CAMPUS_SLOT)).toBe(true);
  });

  it('does not report a constraint as present when the form holds it at another strength', () => {
    const required = new URLSearchParams(BASE);
    required.set('block1-day', Weekday.Friday);
    required.set(slotFieldName('block1', SlotPart.Strength), 'HARD');
    const preferred = fillPlannerQuery(required, buildUnavailableTime());
    expect(preferred.kind).toBe('blocked');
    const holdsPreferred = filled(BASE, buildUnavailableTime());
    const asRequired = fillPlannerQuery(holdsPreferred, buildUnavailableTime(HARD_STRENGTH));
    expect(asRequired.kind).toBe('blocked');
    expect(asRequired.kind === 'blocked' ? asRequired.message : '').toMatch(/Preferred/);
  });
});
