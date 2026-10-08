/**
 * @file Tests for the case wording: every status, reason, subject, resolution, actor, and action,
 * and that none of it claims an approval, a waiver, or a registration.
 */
import { describe, expect, it } from 'vitest';

import {
  CaseAction,
  CaseReason,
  CaseResolution,
  CaseStatus,
  DiscrepancySubject,
  Role,
} from '@caa/domain';

import {
  ADVICE_NOT_PERMISSION,
  CASE_CHANGED,
  CHAT_NOT_SHARED,
  describeAction,
  describeActor,
  describeCaseReason,
  describeCaseStatus,
  describeResolution,
  describeSubject,
  FORM_REJECTED,
  OPEN_CASE_EXISTS,
  REPORT_CHANGES_NOTHING,
  WHO_SEES_THIS,
} from './case-wording';

const BANNED = /approved|granted|waived|registered|enrolled|exception granted/i;

describe('describeCaseStatus', () => {
  it.each(Object.values(CaseStatus))(
    'gives %s a label, an explanation, and a next step, none claiming an approval',
    (status) => {
      const { label, explanation, nextStep } = describeCaseStatus(status);

      expect(label.length).toBeGreaterThan(3);
      expect(explanation.length).toBeGreaterThan(20);
      expect(nextStep.length).toBeGreaterThan(20);
      expect(`${label} ${explanation} ${nextStep}`).not.toMatch(BANNED);
    },
  );

  it('uses a different label for every status', () => {
    const labels = Object.values(CaseStatus).map((status) => describeCaseStatus(status).label);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it('says a resolved case is advice, not permission', () => {
    expect(describeCaseStatus(CaseStatus.Resolved).explanation).toContain(
      'advice, not permission to enroll',
    );
    expect(ADVICE_NOT_PERMISSION).toBe('This is advice, not permission to enroll.');
  });

  it('tells the student nothing is sent, so they check the page', () => {
    expect(describeCaseStatus(CaseStatus.Open).nextStep).toContain('You won’t get an email');
    expect(describeCaseStatus(CaseStatus.InReview).nextStep).toContain('check this page');
  });
});

describe('labels', () => {
  it.each([
    [Object.values(CaseReason), describeCaseReason],
    [Object.values(DiscrepancySubject), describeSubject],
    [Object.values(CaseResolution), describeResolution],
    [Object.values(CaseAction), describeAction],
  ] as const)('gives every value its own plain label', (values, describeValue) => {
    const labels = values.map((value) => describeValue(value as never));

    expect(new Set(labels).size).toBe(values.length);
    expect(labels.join(' ')).not.toMatch(BANNED);
  });

  it('labels the two plan reasons in plain language', () => {
    expect(describeCaseReason(CaseReason.PlanReview)).toBe('Review my plan');
    expect(describeCaseReason(CaseReason.NeedsVerification)).toContain('couldn’t be verified');
  });
});

describe('describeActor', () => {
  it('says You for the signed-in user, whatever the role', () => {
    expect(describeActor(Role.Student, true)).toBe('You');
    expect(describeActor(Role.Advisor, true)).toBe('You');
  });

  it('names other actors by role only', () => {
    expect(describeActor(Role.Advisor, false)).toBe('Your advisor');
    expect(describeActor(Role.Admin, false)).toBe('An administrator');
    expect(describeActor(Role.Student, false)).toBe('A student');
  });
});

describe('fixed messages', () => {
  it('says who sees a submission and that nothing is sent', () => {
    expect(WHO_SEES_THIS).toBe(
      'Your assigned advising team will see this. No email or message is sent.',
    );
    expect(CHAT_NOT_SHARED).toContain('chat is not shared');
  });

  it('says a report changes no official record and is not a waiver request', () => {
    expect(REPORT_CHANGES_NOTHING).toContain('doesn’t change your official records');
    expect(REPORT_CHANGES_NOTHING).toContain('not a request for a waiver');
  });

  it('gives each failure message a next step to take', () => {
    expect(OPEN_CASE_EXISTS).toBe('You already have an open case for this plan.');
    expect(CASE_CHANGED).toContain('Reload the page');
    expect(FORM_REJECTED).toContain('try again');
  });
});
