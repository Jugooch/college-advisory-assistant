/**
 * @file Tests for the notice code enum.
 */
import { describe, expect, it } from 'vitest';

import { NoticeCode, NoticeCodeSchema } from './notice-code.enum';

describe('NoticeCode', () => {
  it('includes the stale and unavailable source codes', () => {
    expect(NoticeCode.StaleSource).toBe('STALE_SOURCE');
    expect(NoticeCode.SourceUnavailable).toBe('SOURCE_UNAVAILABLE');
  });

  it('accepts the new codes and rejects unknown ones', () => {
    expect(NoticeCodeSchema.safeParse('STALE_SOURCE').success).toBe(true);
    expect(NoticeCodeSchema.safeParse('SOURCE_UNAVAILABLE').success).toBe(true);
    expect(NoticeCodeSchema.safeParse('SOURCE_FINE').success).toBe(false);
  });
});
