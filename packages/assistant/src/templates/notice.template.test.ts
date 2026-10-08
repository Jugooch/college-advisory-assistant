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

  it('renders every notice as its exact literal sentence', () => {
    expect(NOTICE_TEMPLATES).toEqual({
      HYPOTHETICAL_NOT_SUPPORTED:
        'What-if scenarios are not supported yet. Your official record is unchanged, and nothing here assumes a different result.',
      OVERRIDE_PROCESS:
        'Prerequisite and requirement overrides are decided through your institution’s official override process, not in this chat. Nothing shown here labels you as allowed or not allowed.',
      GRADE_DISPUTE:
        'If a grade on your record looks wrong, you can open a source discrepancy case so staff can compare it with the official record. This chat does not change your record.',
      PLANNER_INPUT_NEEDED:
        'More information is needed before a schedule can be built. Use the planning form to add the missing choices.',
      TOOL_FAILED:
        'Something went wrong while looking that up, so no result is shown. Please try again.',
      MODEL_UNAVAILABLE:
        'The assistant is unavailable right now. You can still use the planning form and your saved plans.',
      BUDGET_EXHAUSTED:
        'The assistant has reached its usage limit for now. You can still use the planning form and your saved plans.',
      RATE_LIMITED: 'You are sending messages quickly. Please wait a moment and try again.',
      DISABLED:
        'The assistant is turned off for your institution. You can still use the planning form and your saved plans.',
      POLICY_CONFLICT:
        'The approved policy documents disagree on this point, so no answer is shown. Please ask your advisor.',
    });
  });

  it('carries a template version', () => {
    expect(TEMPLATE_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });
});
