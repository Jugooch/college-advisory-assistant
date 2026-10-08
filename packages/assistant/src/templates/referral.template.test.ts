/**
 * @file Tests for the referral templates.
 */
import { describe, expect, it } from 'vitest';

import { SpecialistTopic } from '@caa/domain';

import { CRISIS_SUPPORT_REFERRAL, REFERRAL_TEMPLATES, renderReferral } from './referral.template';

describe('referral templates', () => {
  it('has one non-empty referral per specialist topic', () => {
    for (const topic of Object.values(SpecialistTopic)) {
      expect(renderReferral(topic).length).toBeGreaterThan(0);
    }
    expect(Object.keys(REFERRAL_TEMPLATES)).toHaveLength(Object.values(SpecialistTopic).length);
  });

  it('crisis says chat is not monitored live or an emergency service, and promises no contact', () => {
    const text = renderReferral(SpecialistTopic.Crisis);
    expect(text).toContain('not monitored live');
    expect(text).toContain('not an emergency service');
    expect(text).toContain('no one will contact you');
    expect(text).not.toMatch(/advisor|will reply|notified/i);
  });

  it('renders every referral as its exact literal sentence', () => {
    const notDetermined =
      'This app cannot make that determination, and a schedule that fits your degree says nothing about it. Please ask the office listed below.';
    expect(renderReferral(SpecialistTopic.FinancialAid)).toBe(
      `Financial aid questions need the financial aid office. ${notDetermined}`,
    );
    expect(renderReferral(SpecialistTopic.Immigration)).toBe(
      `Immigration and visa questions need your international student office. ${notDetermined}`,
    );
    expect(renderReferral(SpecialistTopic.Athletics)).toBe(
      `Athletics questions need your athletics compliance office. ${notDetermined}`,
    );
    expect(renderReferral(SpecialistTopic.Accessibility)).toBe(
      `Accessibility and accommodation questions need your accessibility services office. ${notDetermined}`,
    );
    expect(renderReferral(SpecialistTopic.Appeals)).toBe(
      `Appeals need your institution’s official appeals process. ${notDetermined}`,
    );
    expect(renderReferral(SpecialistTopic.Crisis)).toBe(
      'If you are in immediate danger, call your local emergency number now. You can also call or text 988 (the Suicide and Crisis Lifeline in the United States) or contact your campus counseling center. This chat is not monitored live and is not an emergency service, and no one will contact you because of this message.',
    );
  });

  it('tier-2 crisis support has its own id, topic CRISIS, the same resources and no promise of contact', () => {
    expect(CRISIS_SUPPORT_REFERRAL.templateId).toBe('referral.crisis-support');
    expect(CRISIS_SUPPORT_REFERRAL.topic).toBe(SpecialistTopic.Crisis);
    expect(CRISIS_SUPPORT_REFERRAL.text).toBe(
      'If any part of your message is about your safety or how you are feeling, support is available. If you are in immediate danger, call your local emergency number now. You can also call or text 988 (the Suicide and Crisis Lifeline in the United States) or contact your campus counseling center. This chat is not monitored live and is not an emergency service, and no one will contact you because of this message.',
    );
    expect(CRISIS_SUPPORT_REFERRAL.text).not.toBe(renderReferral(SpecialistTopic.Crisis));
  });
});
