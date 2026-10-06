/**
 * @file Tests for the shared modality and weekday wording.
 */
import { describe, expect, it } from 'vitest';

import { SectionModality, Weekday } from '@caa/domain';

import { describeModality, describeWeekday } from './section-wording';

describe('section wording', () => {
  it('words every modality and weekday, distinctly', () => {
    const modalities = Object.values(SectionModality).map(describeModality);
    const days = Object.values(Weekday).map(describeWeekday);
    expect(new Set(modalities).size).toBe(4);
    expect(days).toHaveLength(7);
    expect(describeWeekday('MONDAY')).toBe('Monday');
    expect(describeModality('ONLINE_ASYNCHRONOUS')).toContain('no set meeting times');
  });
});
