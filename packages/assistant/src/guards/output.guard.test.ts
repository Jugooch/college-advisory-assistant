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
  [GuardReason.CreditOrGrade, 'You got an A in Calculus I.'],
  [GuardReason.CreditOrGrade, 'You earned a C in CHEM 101.'],
  [GuardReason.CreditOrGrade, 'You got a B in Biology.'],
  [GuardReason.CreditOrGrade, 'You earned an A in CHEM 101.'],
  [GuardReason.CreditOrGrade, 'You have 45 hours toward your degree.'],
  [GuardReason.CreditOrGrade, 'That is 120 semester hours.'],
  [GuardReason.CreditOrGrade, 'Your result was F.'],
  [GuardReason.Readiness, "You've completed every course in your major."],
  [GuardReason.Readiness, "You're done with your math requirement."],
  [GuardReason.Readiness, 'You finished it.'],
  [GuardReason.Readiness, "You're all set."],
  [GuardReason.DateOrDeadline, 'The add/drop window closes next week.'],
  [GuardReason.DateOrDeadline, 'Withdrawal closes in 3 days.'],
  [GuardReason.DateOrDeadline, 'Registration opens soon.'],
  [GuardReason.DateOrDeadline, 'Classes end in May.'],
  [GuardReason.DateOrDeadline, 'The add window closes in May.'],
  [GuardReason.DateOrDeadline, 'May is busy.'],
  [GuardReason.DateOrDeadline, 'It ends this semester.'],
  [GuardReason.EnrollmentStatus, "You're all set, your classes are booked for spring."],
  [GuardReason.EnrollmentStatus, 'Your seat is reserved.'],
  [GuardReason.EnrollmentStatus, "You're locked in."],
  [GuardReason.EnrollmentStatus, 'You secured a seat.'],
  [GuardReason.EnrollmentStatus, 'It was added to your schedule.'],
  [GuardReason.Digit, 'I found 2 options.'],
  [GuardReason.Digit, 'Take it in year 3.'],
];

const ACCEPTED: readonly string[] = [
  'Here are your schedule options. Each card shows its own checks.',
  'I found a few options that match your choices.',
  'Let me know if you want to change anything.',
  'The cards below come from your saved plan.',
  'Here is your plan and the checks that were run.',
  'I found a few options that fit what you said.',
];

describe('guardIntro', () => {
  it.each(REJECTED)('rejects with %s: %s', (reason, text) => {
    const result = guardIntro(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain(reason);
      expect(new Set(result.reasons).size).toBe(result.reasons.length);
    }
  });

  it('never repeats a reason code', () => {
    expect(guardIntro('You got a B in Biology.')).toEqual({
      ok: false,
      reasons: [GuardReason.CreditOrGrade],
    });
  });

  it('rejects non-ASCII characters left after normalization', () => {
    expect(guardIntro('Here are your options А')).toEqual({
      ok: false,
      reasons: [GuardReason.NonAscii],
    });
  });

  it('returns the original text, unnormalized, when it passes', () => {
    const text = 'Here are your options.';
    expect(guardIntro(text)).toEqual({ ok: true, text });
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
      reasons: [
        GuardReason.Eligibility,
        GuardReason.EnrollmentStatus,
        GuardReason.AcademicAction,
        GuardReason.Url,
      ],
    });
    expect(guardIntro('You are eligible and registered, see https://x.edu')).toEqual(first);
  });

  it('is case-insensitive', () => {
    expect(guardIntro('ELIGIBLE').ok).toBe(false);
  });
});
