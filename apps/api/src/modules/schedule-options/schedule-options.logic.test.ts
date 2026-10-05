/**
 * @file Tests for the pure schedule-options steps: canonical JSON and request normalization for
 * the pinned hash. Solving and the assembled response are tested through the service.
 * @requirement FR-07
 * @requirement NFR-01
 */
import { describe, expect, it } from 'vitest';

import {
  buildAllowedModalities,
  buildCreditRange,
  buildUnavailableTime,
  HARD_STRENGTH,
} from '@caa/test-kit';

import { scheduleRequest } from '../../testing/schedule-options-harness';
import { SEED_COURSES } from '../../testing/seed-scenario-fixtures';
import { canonicalJson, normalizeScheduleRequest } from './schedule-options.logic';

const { math102, ind390, engl101 } = SEED_COURSES;
const hardTime = buildUnavailableTime({ ...HARD_STRENGTH });
const hardModalities = buildAllowedModalities({ ...HARD_STRENGTH });
const rank1 = buildCreditRange({ priorityRank: 1 });
const rank2 = buildUnavailableTime({ priorityRank: 2 });

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
  const base = scheduleRequest({
    courseIds: [math102.id, ind390.id, engl101.id],
    creditSelections: [{ courseId: ind390.id, selectedCreditsHundredths: 300 }],
    constraints: [hardTime, rank2, hardModalities, rank1],
  });

  it('gives the same text for the same request in another order', () => {
    const reordered = {
      ...base,
      courseIds: [engl101.id, ind390.id, math102.id],
      constraints: [rank1, hardModalities, rank2, hardTime],
    };

    expect(normalizeScheduleRequest(reordered)).toBe(normalizeScheduleRequest(base));
  });

  it.each([
    ['another course', { courseIds: [math102.id, ind390.id] }],
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
});
