/**
 * @file Tests for the plan wording: every freshness state, stale reason, and open case status.
 */
import { describe, expect, it } from 'vitest';

import { CaseStatus, PlanFreshness, PlanStaleReason } from '@caa/domain';

import {
  describeFreshness,
  describeOpenCase,
  describeStaleReason,
  NO_OPEN_CASE,
} from './plan-wording';

const BANNED = /registered|enrolled|approved/i;

describe('describeFreshness', () => {
  it('uses the three labels and never shows UNKNOWN as up to date', () => {
    expect(describeFreshness(PlanFreshness.Current).label).toBe('Up to date');
    expect(describeFreshness(PlanFreshness.Stale).label).toBe('Out of date');
    expect(describeFreshness(PlanFreshness.Unknown).label).toBe('Couldn’t check');
  });

  it.each(Object.values(PlanFreshness))('keeps %s free of registration claims', (state) => {
    const { label, explanation } = describeFreshness(state);

    expect(`${label} ${explanation}`).not.toMatch(BANNED);
  });
});

describe('describeStaleReason', () => {
  it.each(Object.values(PlanStaleReason))('has its own sentence for %s', (reason) => {
    const sentence = describeStaleReason(reason);

    expect(sentence.length).toBeGreaterThan(10);
    expect(sentence).not.toMatch(BANNED);
  });

  it('gives each reason different wording', () => {
    const sentences = Object.values(PlanStaleReason).map(describeStaleReason);

    expect(new Set(sentences).size).toBe(sentences.length);
  });
});

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
