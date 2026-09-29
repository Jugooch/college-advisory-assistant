/**
 * @file Tests for `isSourceFresh`: the maximum-age boundary, the future tolerance, and missing or
 * unparseable times. Moved unchanged from the pinned records tests (ADR-0008).
 * @requirement FR-04
 * @requirement NFR-01
 */
import { describe, expect, it } from 'vitest';

import { isSourceFresh, SOURCE_TIME_FUTURE_TOLERANCE_MS } from './source-freshness.logic';

describe('isSourceFresh', () => {
  const policy = { now: new Date('2026-09-02T00:00:00.000Z'), maxAgeMs: 86_400_000 };

  it.each([
    ['just inside the maximum age', '2026-09-01T00:00:00.001Z', true],
    ['exactly at the maximum age', '2026-09-01T00:00:00.000Z', true],
    ['just past the maximum age', '2026-08-31T23:59:59.999Z', false],
    ['at the clock', '2026-09-02T00:00:00.000Z', true],
    ['in the future within the tolerance', '2026-09-02T00:05:00.000Z', true],
    ['in the future beyond the tolerance', '2026-09-02T00:05:00.001Z', false],
    ['unparseable', 'not-a-time', false],
    ['missing', null, false],
  ])('treats a time %s as fresh: %s', (_case, time, isFresh) => {
    expect(isSourceFresh(time, policy)).toBe(isFresh);
  });

  it('allows five minutes of clock drift into the future', () => {
    expect(SOURCE_TIME_FUTURE_TOLERANCE_MS).toBe(300_000);
  });
});
