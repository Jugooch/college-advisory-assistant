/**
 * @file Tests for the referral templates.
 */
import { describe, expect, it } from 'vitest';

import { SpecialistTopic } from '@caa/domain';

import { REFERRAL_TEMPLATES, renderReferral } from './referral.template';

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
});
