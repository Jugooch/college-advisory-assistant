/**
 * @file Tests for the fixed templates: coverage of every code and topic, and safe wording.
 */
import { describe, expect, it } from 'vitest';

import { AssistantBlockKind, NoticeCode, SpecialistTopic } from '@caa/domain';

import { guardIntro } from '../guards/output.guard';
import { fallbackIntro } from './intro.template';
import { NOTICE_TEMPLATES, renderNotice, TEMPLATE_VERSION } from './notice.template';
import { REFERRAL_TEMPLATES, renderReferral } from './referral.template';

describe('templates', () => {
  it('has one non-empty text per notice code', () => {
    for (const code of Object.values(NoticeCode)) {
      expect(renderNotice(code).length).toBeGreaterThan(0);
    }
    expect(Object.keys(NOTICE_TEMPLATES)).toHaveLength(Object.values(NoticeCode).length);
  });

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

  it('hypothetical notice says scenarios are unsupported and the record is unchanged', () => {
    const text = renderNotice(NoticeCode.HypotheticalNotSupported);
    expect(text).toContain('not supported');
    expect(text).toContain('record is unchanged');
  });

  it('never upgrades a status in any notice or referral', () => {
    const all = [...Object.values(NOTICE_TEMPLATES), ...Object.values(REFERRAL_TEMPLATES)];
    for (const text of all) {
      expect(text).not.toMatch(/\beligible\b|\bready\b|\bon track\b|\bsatisfied\b/i);
    }
  });

  it('picks a fallback intro from the block kinds, with a default', () => {
    expect(fallbackIntro([AssistantBlockKind.ScheduleOptions])).toBe(
      'Here are your schedule options. Each card shows its own checks.',
    );
    expect(fallbackIntro([AssistantBlockKind.Notice, AssistantBlockKind.ScheduleOptions])).toBe(
      fallbackIntro([AssistantBlockKind.ScheduleOptions]),
    );
    expect(fallbackIntro([])).toBe(fallbackIntro([AssistantBlockKind.Notice]));
  });

  it('every fallback intro passes the output guard', () => {
    for (const kind of Object.values(AssistantBlockKind)) {
      expect(guardIntro(fallbackIntro([kind])).ok).toBe(true);
    }
  });

  it('carries a template version', () => {
    expect(TEMPLATE_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });
});
