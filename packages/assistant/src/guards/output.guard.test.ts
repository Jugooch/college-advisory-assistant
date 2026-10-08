/**
 * @file Tests for the intro guard: each pattern, near-misses, and the 600/601 boundary.
 */
import { describe, expect, it } from 'vitest';

import { guardIntro, GuardReason, MAX_INTRO_LENGTH } from './output.guard';

const REJECTED: readonly (readonly [GuardReason, string])[] = [
  [GuardReason.CreditOrGrade, 'You will earn 3 credits.'],
  [GuardReason.CreditOrGrade, 'That is 12 credit hours.'],
  [GuardReason.CreditOrGrade, 'You got a B+ there.'],
  [GuardReason.CreditOrGrade, 'Your GPA is fine.'],
  [GuardReason.Eligibility, 'You are eligible for this one.'],
  [GuardReason.Eligibility, 'You qualify for the course.'],
  [GuardReason.Prerequisite, 'The prerequisite is done.'],
  [GuardReason.Prerequisite, 'Check the coreq.'],
  [GuardReason.PassFail, 'You passed it.'],
  [GuardReason.PassFail, 'You might fail.'],
  [GuardReason.PassFail, "I'm not sure what pass/fail means."],
  [GuardReason.MetOrSatisfied, 'The requirement is met.'],
  [GuardReason.MetOrSatisfied, 'That is satisfied.'],
  [GuardReason.StatusLabel, 'The status is UNKNOWN.'],
  [GuardReason.StatusLabel, 'It is conditional.'],
  [GuardReason.Readiness, 'You are on track.'],
  [GuardReason.Readiness, 'You are ready to go.'],
  [GuardReason.DateOrDeadline, 'The deadline is soon.'],
  [GuardReason.DateOrDeadline, 'Do it by October 5.'],
  [GuardReason.DateOrDeadline, 'See 10/05/2026.'],
  [GuardReason.DateOrDeadline, 'Classes start Monday.'],
  [GuardReason.EnrollmentStatus, 'You are registered.'],
  [GuardReason.EnrollmentStatus, 'You are enrolled.'],
  [GuardReason.EnrollmentStatus, 'It was approved.'],
  [GuardReason.Confidence, 'I am 90% sure.'],
  [GuardReason.Confidence, 'That is likely fine.'],
  [GuardReason.AdvisorPromise, 'Your advisor has been notified.'],
  [GuardReason.AdvisorPromise, 'An advisor will reply soon.'],
  [GuardReason.AdvisorPromise, 'Someone will get back to you.'],
  [GuardReason.Url, 'See https://example.edu/page.'],
  [GuardReason.Url, 'Visit www.example.com now.'],
  [GuardReason.Url, 'Open registrar.example.edu'],
  [GuardReason.Url, 'Click [here](x).'],
];

const ACCEPTED: readonly string[] = [
  'Here are your schedule options. Each card shows its own checks.',
  'I found a few options that match your choices.',
  'Let me know if you want to change anything.',
  'The cards below come from your saved plan.',
];

describe('guardIntro', () => {
  it.each(REJECTED)('rejects with %s: %s', (reason, text) => {
    const result = guardIntro(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain(reason);
    }
  });

  it.each(ACCEPTED)('accepts unchanged: %s', (text) => {
    expect(guardIntro(text)).toEqual({ ok: true, text });
  });

  it('accepts exactly 600 characters and rejects 601 without truncating', () => {
    const at = 'a'.repeat(MAX_INTRO_LENGTH);
    expect(guardIntro(at)).toEqual({ ok: true, text: at });
    const over = guardIntro('a'.repeat(MAX_INTRO_LENGTH + 1));
    expect(over).toEqual({ ok: false, reasons: [GuardReason.TooLong] });
  });

  it('rejects empty and whitespace-only text', () => {
    expect(guardIntro('')).toEqual({ ok: false, reasons: [GuardReason.Empty] });
    expect(guardIntro('   \n')).toEqual({ ok: false, reasons: [GuardReason.Empty] });
  });

  it('lists every matching reason in a fixed order', () => {
    const first = guardIntro('You are eligible and registered, see https://x.edu');
    expect(first).toEqual({
      ok: false,
      reasons: [GuardReason.Eligibility, GuardReason.EnrollmentStatus, GuardReason.Url],
    });
    expect(guardIntro('You are eligible and registered, see https://x.edu')).toEqual(first);
  });

  it('is case-insensitive', () => {
    expect(guardIntro('ELIGIBLE').ok).toBe(false);
  });
});
