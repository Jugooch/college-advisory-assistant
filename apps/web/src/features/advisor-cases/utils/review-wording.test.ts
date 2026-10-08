/**
 * @file Tests for the reviewer's wording: every status, reason, actor, resolution option, empty
 * state, and outcome is described, and none says a request was approved or waived.
 */
import { describe, expect, it } from 'vitest';

import { CaseAction, CaseReason, CaseResolution, CaseStatus, Role } from '@caa/domain';

import {
  describeCaseStanding,
  describeEmptyQueue,
  describeQueueStatus,
  describeResolutionOption,
  describeReviewActor,
  describeReviewDone,
  describeReviewReason,
  RESOLVE_DISCLAIMER,
} from './review-wording';

const ALL_WORDING = [
  ...Object.values(CaseStatus).map(describeQueueStatus),
  ...Object.values(CaseReason).map(describeReviewReason),
  ...Object.values(CaseResolution).map(describeResolutionOption),
  ...[CaseAction.Claim, CaseAction.Release, CaseAction.Resolve].flatMap((action) => {
    const done = describeReviewDone(action);
    return [done.message, done.nextStep];
  }),
];

describe('review wording', () => {
  it('never says a request was approved, granted, or waived', () => {
    for (const text of ALL_WORDING) {
      expect(text).not.toMatch(/\b(approved|granted|waived|registered)\b/i);
    }
  });

  it('says the resolve note is visible to the student and is not an official waiver or approval', () => {
    expect(RESOLVE_DISCLAIMER).toContain('student can read your note');
    expect(RESOLVE_DISCLAIMER).toContain('not an official waiver, exception, or approval');
    expect(RESOLVE_DISCLAIMER).toContain('permission to enroll');
  });

  it('names actors by role and You, never by ID', () => {
    expect(describeReviewActor(Role.Advisor, true)).toBe('You');
    expect(describeReviewActor(Role.Advisor, false)).toBe('Another advisor');
    expect(describeReviewActor(Role.Admin, false)).toBe('An administrator');
    expect(describeReviewActor(Role.Student, false)).toBe('The student');
  });

  it('describes who holds each status', () => {
    expect(describeCaseStanding(CaseStatus.Open, null)).toContain('No one has claimed');
    expect(describeCaseStanding(CaseStatus.InReview, { role: Role.Advisor, isYou: true })).toBe(
      'You are reviewing this case.',
    );
    expect(
      describeCaseStanding(CaseStatus.InReview, { role: Role.Advisor, isYou: false }),
    ).toContain('Another advisor is reviewing');
    expect(describeCaseStanding(CaseStatus.Resolved, { role: Role.Admin, isYou: false })).toContain(
      'An administrator resolved',
    );
    expect(
      describeCaseStanding(CaseStatus.Resolved, { role: Role.Advisor, isYou: true }),
    ).toContain('You resolved');
    expect(describeCaseStanding(CaseStatus.Withdrawn, null)).toContain('withdrew');
  });

  it('gives every empty queue an explanation and a next step', () => {
    for (const filter of [
      { kind: 'all' },
      { kind: 'unrouted' },
      { kind: 'status', status: CaseStatus.Resolved },
    ] as const) {
      const empty = describeEmptyQueue(filter);
      expect(empty.heading.length).toBeGreaterThan(0);
      expect(empty.explanation.length).toBeGreaterThan(0);
      expect(empty.nextStep.length).toBeGreaterThan(0);
    }
    expect(describeEmptyQueue({ kind: 'status', status: CaseStatus.Resolved }).heading).toBe(
      'No resolved cases',
    );
  });

  it('describes a generic update for an action the screen does not offer', () => {
    expect(describeReviewDone(CaseAction.Withdraw).message).toBe('The case was updated.');
  });
});
