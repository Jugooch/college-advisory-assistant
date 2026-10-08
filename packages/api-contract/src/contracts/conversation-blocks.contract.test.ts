/**
 * @file Tests for the assistant block union.
 */
import { describe, expect, it } from 'vitest';

import { buildRevisionView, PLAN_ID } from '../testing/plan-draft-fixtures';
import { buildResponse } from '../testing/schedule-option-fixtures';
import { AssistantBlockSchema } from './conversation-blocks.contract';

const AS_OF = '2026-10-08T09:00:00-05:00';
const HIT = {
  documentKey: 'withdrawal-deadline',
  revision: 2,
  title: 'Withdrawal deadline',
  excerpt: 'Students may withdraw before the ninth week.',
  topic: 'GENERAL',
  effectiveFrom: '2026-08-01T00:00:00-05:00',
  effectiveTo: null,
  sourceLabel: 'Synthetic Registrar Handbook',
  approvedAt: '2026-07-15T12:00:00-05:00',
  conflict: false,
};
const SUMMARY = {
  student: { id: '2b3c4d5e-0000-4000-8000-000000000001', sourceStudentId: 'DEMO-S-0001' },
  studentSnapshot: {
    id: '3c4d5e6f-0000-4000-8000-000000000001',
    programId: '4d5e6f70-0000-4000-8000-000000000001',
    catalogYear: '2025-2026',
    sourceEffectiveAt: '2026-08-20T09:00:00-05:00',
    programName: null,
  },
  audit: null,
  auditReflectsRecord: null,
  programCatalogConsistency: null,
  courses: [],
  requirements: [],
};
const CREDIT_RANGE = {
  kind: 'CREDIT_RANGE',
  strength: 'PREFERRED',
  priorityRank: 1,
  minCreditsHundredths: 1200,
  maxCreditsHundredths: null,
};
const PROPOSAL = {
  kind: 'CONSTRAINT_PROPOSAL',
  constraints: [{ constraint: CREDIT_RANGE, confirmed: false }],
};
const CASE_PREVIEW = {
  kind: 'CASE_PREVIEW',
  reason: 'PLAN_REVIEW',
  planId: PLAN_ID,
  planRevision: 1,
  discrepancySubject: null,
  suggestedNote: 'Please review my plan.',
  queueLabel: 'Advisors assigned to you',
};
const NOTICE = {
  kind: 'NOTICE',
  code: 'TOOL_FAILED',
  templateId: 'notice.tool-failed',
  templateVersion: '1',
  text: 'That check could not run. Use the planner form.',
};
const REFERRAL = {
  kind: 'REFERRAL',
  topic: 'FINANCIAL_AID',
  templateId: 'referral.financial-aid',
  templateVersion: '1',
  text: 'Please contact the financial aid office.',
  policy: null,
  asOf: AS_OF,
};

/**
 * Returns whether the block schema accepts a payload.
 *
 * @param payload - Candidate block.
 * @returns `true` when it parses.
 */
const accepts = (payload: unknown): boolean => AssistantBlockSchema.safeParse(payload).success;

describe('AssistantBlockSchema kinds', () => {
  it.each([
    ['SCHEDULE_OPTIONS', { kind: 'SCHEDULE_OPTIONS', result: buildResponse() }],
    ['PLAN_EVIDENCE', { kind: 'PLAN_EVIDENCE', plan: buildRevisionView() }],
    ['ACADEMIC_SUMMARY', { kind: 'ACADEMIC_SUMMARY', summary: SUMMARY }],
    ['POLICY_RESULTS', { kind: 'POLICY_RESULTS', results: { hits: [HIT], asOf: AS_OF } }],
    ['CONSTRAINT_PROPOSAL', PROPOSAL],
    ['CASE_PREVIEW', CASE_PREVIEW],
    ['NOTICE', NOTICE],
    ['REFERRAL', REFERRAL],
    ['REFERRAL with a policy', { ...REFERRAL, policy: HIT }],
  ])('accepts a %s block', (_name, block) => {
    expect(accepts(block)).toBe(true);
  });

  it('rejects a block kind outside the enum', () => {
    expect(accepts({ ...NOTICE, kind: 'FREE_TEXT' })).toBe(false);
  });

  it('rejects unknown keys on a block', () => {
    expect(accepts({ ...NOTICE, extra: 'x' })).toBe(false);
  });

  it('rejects a data block whose payload is invalid', () => {
    expect(accepts({ kind: 'SCHEDULE_OPTIONS', result: { outcome: 'OPTIONS_FOUND' } })).toBe(false);
  });
});

describe('POLICY_RESULTS block', () => {
  it('rejects a hit that does not apply at asOf', () => {
    const early = { ...HIT, effectiveFrom: '2026-10-09T00:00:00-05:00' };
    expect(accepts({ kind: 'POLICY_RESULTS', results: { hits: [early], asOf: AS_OF } })).toBe(
      false,
    );
  });

  it('rejects a hit that expired at asOf', () => {
    const expired = { ...HIT, effectiveTo: AS_OF };
    expect(accepts({ kind: 'POLICY_RESULTS', results: { hits: [expired], asOf: AS_OF } })).toBe(
      false,
    );
  });

  it('rejects a repeated document key and more than three hits', () => {
    const twice = { kind: 'POLICY_RESULTS', results: { hits: [HIT, HIT], asOf: AS_OF } };
    expect(accepts(twice)).toBe(false);
    const hits = ['a', 'b', 'c', 'd'].map((documentKey) => ({ ...HIT, documentKey }));
    expect(accepts({ kind: 'POLICY_RESULTS', results: { hits, asOf: AS_OF } })).toBe(false);
  });
});

describe('CONSTRAINT_PROPOSAL block', () => {
  it('rejects a constraint that is already confirmed', () => {
    const confirmed = { ...PROPOSAL, constraints: [{ constraint: CREDIT_RANGE, confirmed: true }] };
    expect(accepts(confirmed)).toBe(false);
  });

  it('rejects a missing confirmed flag and an empty proposal', () => {
    expect(accepts({ ...PROPOSAL, constraints: [{ constraint: CREDIT_RANGE }] })).toBe(false);
    expect(accepts({ ...PROPOSAL, constraints: [] })).toBe(false);
  });

  it('rejects a set whose preferences share a rank', () => {
    const other = { ...CREDIT_RANGE, kind: 'ALLOWED_MODALITIES', modalities: ['IN_PERSON'] };
    const twoRanks = [CREDIT_RANGE, other].map((constraint) => ({ constraint, confirmed: false }));
    expect(accepts({ ...PROPOSAL, constraints: twoRanks })).toBe(false);
  });
});

describe('CASE_PREVIEW block', () => {
  it('accepts a source discrepancy with a subject and no plan', () => {
    const discrepancy = {
      ...CASE_PREVIEW,
      reason: 'SOURCE_DISCREPANCY',
      planId: null,
      planRevision: null,
      discrepancySubject: 'COURSE_ATTEMPT',
    };
    expect(accepts(discrepancy)).toBe(true);
  });

  it('rejects a plan review without a plan', () => {
    expect(accepts({ ...CASE_PREVIEW, planId: null, planRevision: null })).toBe(false);
  });

  it('rejects a plan ID without its revision, and the reverse', () => {
    expect(accepts({ ...CASE_PREVIEW, planRevision: null })).toBe(false);
    expect(accepts({ ...CASE_PREVIEW, planId: null })).toBe(false);
  });

  it('rejects a subject on another reason', () => {
    expect(accepts({ ...CASE_PREVIEW, discrepancySubject: 'COURSE_ATTEMPT' })).toBe(false);
  });

  it('accepts an empty note and rejects a note over 500 characters', () => {
    expect(accepts({ ...CASE_PREVIEW, suggestedNote: '' })).toBe(true);
    expect(accepts({ ...CASE_PREVIEW, suggestedNote: 'a'.repeat(501) })).toBe(false);
  });
});

describe('REFERRAL policy freshness', () => {
  const accepted = (policy: unknown): boolean => accepts({ ...REFERRAL, policy });

  it('rejects an expired and a not-yet-effective policy', () => {
    expect(accepted({ ...HIT, effectiveTo: '2026-10-08T08:59:59-05:00' })).toBe(false);
    expect(accepted({ ...HIT, effectiveFrom: '2026-10-08T09:00:01-05:00' })).toBe(false);
  });

  it('applies effectiveFrom <= asOf < effectiveTo at the boundaries', () => {
    expect(accepted({ ...HIT, effectiveFrom: AS_OF })).toBe(true);
    expect(accepted({ ...HIT, effectiveTo: AS_OF })).toBe(false);
    expect(accepted({ ...HIT, effectiveTo: '2026-10-08T09:00:01-05:00' })).toBe(true);
  });

  it('compares instants across offsets and requires asOf', () => {
    expect(accepted({ ...HIT, effectiveTo: '2026-10-08T14:00:00Z' })).toBe(false);
    expect(accepts({ ...REFERRAL, asOf: undefined })).toBe(false);
  });
});

describe('proposal strength', () => {
  it('rejects a HARD proposed constraint', () => {
    const hard = {
      ...PROPOSAL,
      constraints: [{ constraint: { ...CREDIT_RANGE, strength: 'HARD' }, confirmed: false }],
    };
    expect(accepts(hard)).toBe(false);
  });
});

describe('NOTICE and REFERRAL blocks', () => {
  it('rejects empty text and text over the template limit', () => {
    expect(accepts({ ...NOTICE, text: '' })).toBe(false);
    expect(accepts({ ...NOTICE, text: 'a'.repeat(1001) })).toBe(false);
  });

  it('rejects an unknown notice code and an unknown topic', () => {
    expect(accepts({ ...NOTICE, code: 'OTHER' })).toBe(false);
    expect(accepts({ ...REFERRAL, topic: 'OTHER' })).toBe(false);
  });

  it('keeps the template identity bounds of the stored block reference', () => {
    expect(accepts({ ...NOTICE, templateId: 'a'.repeat(101) })).toBe(false);
    expect(accepts({ ...NOTICE, templateVersion: 'a'.repeat(51) })).toBe(false);
  });

  it('requires an explicit null policy on a referral', () => {
    const missing = Object.fromEntries(
      Object.entries(REFERRAL).filter(([key]) => key !== 'policy'),
    );
    expect(accepts(missing)).toBe(false);
  });
});
