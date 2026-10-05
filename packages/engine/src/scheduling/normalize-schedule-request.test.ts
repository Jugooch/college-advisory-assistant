/**
 * @file Tests for the schedule request normalizer: canonical JSON with keys sorted by code unit,
 * and the same text for the same request in any order.
 */
import { describe, expect, it } from 'vitest';

import type { CourseId, TermId } from '@caa/domain';
import {
  buildAllowedModalities,
  buildCreditRange,
  buildUnavailableTime,
  HARD_STRENGTH,
} from '@caa/test-kit';

import {
  canonicalJson,
  type NormalizableScheduleRequest,
  normalizeScheduleRequest,
} from './normalize-schedule-request';

const TERM = 'a0000000-0000-4000-8000-000000000001' as TermId;
const MATH = 'b0000000-0000-4000-8000-00000000000a' as CourseId;
const IND = 'b0000000-0000-4000-8000-00000000000b' as CourseId;
const ENGL = 'b0000000-0000-4000-8000-00000000000c' as CourseId;

const hardTime = buildUnavailableTime({ ...HARD_STRENGTH });
const hardModalities = buildAllowedModalities({ ...HARD_STRENGTH });
const rank1 = buildCreditRange({ priorityRank: 1 });
const rank2 = buildUnavailableTime({ priorityRank: 2 });

const base: NormalizableScheduleRequest = {
  termId: TERM,
  courseIds: [MATH, IND, ENGL],
  creditSelections: [
    { courseId: IND, selectedCreditsHundredths: 300 },
    { courseId: MATH, selectedCreditsHundredths: 400 },
  ],
  constraints: [hardTime, rank2, hardModalities, rank1],
};

describe('canonicalJson', () => {
  it('sorts object keys at every depth and keeps array order', () => {
    expect(canonicalJson({ b: [{ z: 1, a: null }], a: 'x' })).toBe(
      '{"a":"x","b":[{"a":null,"z":1}]}',
    );
  });

  it('orders keys by UTF-16 code unit, never by locale', () => {
    expect(canonicalJson({ b: 1, B: 2, a: 3 })).toBe('{"B":2,"a":3,"b":1}');
  });
});

describe('normalizeScheduleRequest', () => {
  it.each([
    ['courses', { courseIds: [ENGL, IND, MATH] }],
    ['credit selections', { creditSelections: base.creditSelections.toReversed() }],
    ['hard constraints', { constraints: [hardModalities, rank2, hardTime, rank1] }],
    ['preferences', { constraints: [hardTime, rank1, hardModalities, rank2] }],
    ['everything', { courseIds: [ENGL, MATH, IND], constraints: base.constraints.toReversed() }],
  ])('gives the same text with the %s in another order', (_case, change) => {
    expect(normalizeScheduleRequest({ ...base, ...change })).toBe(normalizeScheduleRequest(base));
  });

  it.each([
    ['another course', { courseIds: [MATH, IND] }],
    ['another credit choice', { creditSelections: [] }],
    [
      'swapped preference ranks',
      {
        constraints: [
          hardTime,
          hardModalities,
          { ...rank1, priorityRank: 2 },
          { ...rank2, priorityRank: 1 },
        ],
      },
    ],
  ])('gives different text for %s', (_case, change) => {
    expect(normalizeScheduleRequest({ ...base, ...change })).not.toBe(
      normalizeScheduleRequest(base),
    );
  });

  it('writes the normalized request as canonical JSON', () => {
    expect(normalizeScheduleRequest(base)).toBe(
      [
        '{"courseIds":["b0000000-0000-4000-8000-00000000000a",',
        '"b0000000-0000-4000-8000-00000000000b","b0000000-0000-4000-8000-00000000000c"],',
        '"creditSelections":[',
        '{"courseId":"b0000000-0000-4000-8000-00000000000a","selectedCreditsHundredths":400},',
        '{"courseId":"b0000000-0000-4000-8000-00000000000b","selectedCreditsHundredths":300}],',
        '"hardConstraints":[',
        '{"endTime":"24:00","kind":"UNAVAILABLE_TIME","priorityRank":null,"startTime":"00:00",',
        '"strength":"HARD","weekdays":["FRIDAY"]},',
        '{"kind":"ALLOWED_MODALITIES","modalities":["IN_PERSON"],"priorityRank":null,',
        '"strength":"HARD"}],',
        '"preferences":[',
        '{"kind":"CREDIT_RANGE","maxCreditsHundredths":1500,"minCreditsHundredths":1200,',
        '"priorityRank":1,"strength":"PREFERRED"},',
        '{"endTime":"24:00","kind":"UNAVAILABLE_TIME","priorityRank":2,"startTime":"00:00",',
        '"strength":"PREFERRED","weekdays":["FRIDAY"]}],',
        '"termId":"a0000000-0000-4000-8000-000000000001"}',
      ].join(''),
    );
  });
});
