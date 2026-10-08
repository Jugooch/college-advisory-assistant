/**
 * @file Tests for the notice templates.
 */
import { describe, expect, it } from 'vitest';

import { NoticeCode } from '@caa/domain';

import { NOTICE_TEMPLATES, renderNotice, TEMPLATE_VERSION } from './notice.template';
import { REFERRAL_TEMPLATES } from './referral.template';

describe('notice templates', () => {
  it('has one non-empty text per notice code', () => {
    for (const code of Object.values(NoticeCode)) {
      expect(renderNotice(code).length).toBeGreaterThan(0);
    }
    expect(Object.keys(NOTICE_TEMPLATES)).toHaveLength(Object.values(NoticeCode).length);
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

  it('carries a template version', () => {
    expect(TEMPLATE_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });
});
