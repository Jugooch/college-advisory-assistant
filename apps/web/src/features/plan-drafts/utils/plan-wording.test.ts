/**
 * @file Tests for the plan wording: every open advisor case status.
 */
import { describe, expect, it } from 'vitest';

import { CaseStatus } from '@caa/domain';

import { describeOpenCase, NO_OPEN_CASE } from './plan-wording';

const BANNED = /registered|enrolled|approved/i;

describe('describeOpenCase', () => {
  it('says there is no open case for null', () => {
    expect(describeOpenCase(null)).toBe(NO_OPEN_CASE);
  });

  it('describes each open status differently', () => {
    const open = describeOpenCase(CaseStatus.Open);
    const inReview = describeOpenCase(CaseStatus.InReview);

    expect(open).not.toBe(inReview);
    expect(`${open} ${inReview}`).not.toMatch(BANNED);
  });
});
