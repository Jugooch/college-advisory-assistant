/**
 * @file Tests that every reason code has fixed wording with a next step and no overclaim.
 */
import { describe, expect, it } from 'vitest';

import { ReasonCode } from '@caa/domain';

import { describeReason, REASON_CODE_WORDING } from './reason-code-wording';

const EVERY_CODE = Object.values(ReasonCode);

describe('REASON_CODE_WORDING', () => {
  it.each(EVERY_CODE)('has an explanation and a next step for %s', (code) => {
    const wording = describeReason(code);

    expect(wording.explanation.trim()).not.toBe('');
    expect(wording.nextStep.trim()).not.toBe('');
  });

  it('covers exactly the reason codes in the domain registry', () => {
    expect(Object.keys(REASON_CODE_WORDING).sort()).toEqual([...EVERY_CODE].sort());
  });

  it.each(EVERY_CODE)('never claims approval, eligibility, or registration for %s', (code) => {
    const { explanation, nextStep } = describeReason(code);

    expect(`${explanation} ${nextStep}`).not.toMatch(/approved|eligible|registered/i);
  });

  it('states the conditional grade requirement for IN_PROGRESS_MIN_GRADE', () => {
    expect(describeReason(ReasonCode.InProgressMinGrade)).toEqual({
      explanation:
        'This depends on a course you are taking now. It is met only if you earn the required grade.',
      nextStep:
        'Earn at least the grade shown in the evidence, then check again after grades post.',
    });
  });

  it.each([
    ReasonCode.TransitionTimeUndefined,
    ReasonCode.MeetingTimeUnknown,
    ReasonCode.MeetingLocationUnknown,
    ReasonCode.LinkedSectionUnavailable,
    ReasonCode.LinkedCourseNotChecked,
    ReasonCode.SectionDataMissing,
    ReasonCode.PrerequisiteRuleMissing,
  ])('says %s needs verification and names a human route', (code) => {
    const { nextStep } = describeReason(code);

    expect(nextStep).toMatch(/needing verification/);
    expect(nextStep).toMatch(/your advisor or the registrar/);
  });

  it('says the linked course may add credits or have a prerequisite and is unchecked for LINKED_COURSE_NOT_CHECKED', () => {
    const { explanation } = describeReason(ReasonCode.LinkedCourseNotChecked);

    expect(explanation).toContain('may add its own credits or have its own prerequisite');
    expect(explanation).toContain('haven’t been checked');
  });

  it('never assumes an undefined travel time is enough', () => {
    expect(describeReason(ReasonCode.TransitionTimeUndefined).explanation).toContain(
      'It isn’t assumed to be enough.',
    );
  });

  it('says it is not known whether the course has prerequisites for PREREQUISITE_RULE_MISSING', () => {
    expect(describeReason(ReasonCode.PrerequisiteRuleMissing).explanation).toContain(
      'isn’t known whether the course has prerequisites',
    );
  });
});
