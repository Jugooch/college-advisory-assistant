/**
 * @file Tests for the synthetic policy corpus.
 */
import { describe, expect, it } from 'vitest';

import { PolicyDocumentSchema, SpecialistTopic } from '@caa/domain';

import { buildPolicyCorpus, POLICY_CORPUS_AS_OF } from './policy-corpus.builder';

const corpus = buildPolicyCorpus();
const byKey = (key: string, revision = 1) =>
  corpus.find((d) => d.documentKey === key && d.revision === revision);

describe('buildPolicyCorpus', () => {
  it('holds seventeen documents that all parse, with distinct ids', () => {
    expect(corpus).toHaveLength(17);
    expect(corpus.every((d) => PolicyDocumentSchema.safeParse(d).success)).toBe(true);
    expect(new Set(corpus.map((d) => d.id)).size).toBe(17);
  });

  it('is stable across calls', () => {
    expect(buildPolicyCorpus()).toEqual(corpus);
    expect(POLICY_CORPUS_AS_OF).toBe('2026-09-22T10:00:00.000-05:00');
  });

  it('has two current student documents on different subjects', () => {
    expect(byKey('late-registration')?.subjectKey).toBe('late-registration');
    expect(byKey('course-withdrawal')?.subjectKey).toBe('course-withdrawal');
  });

  it('has a newer revision of late-registration that is not effective yet', () => {
    expect(byKey('late-registration', 2)?.effectiveFrom).toBe('2027-01-01T00:00:00.000-06:00');
  });

  it('has an expired document ending before the as-of instant', () => {
    expect(byKey('summer-housing')?.effectiveTo).toBe('2026-05-01T00:00:00.000-05:00');
  });

  it('has a draft and a withdrawn document', () => {
    expect(byKey('draft-parking')).toMatchObject({ approvalStatus: 'DRAFT', approvedAt: null });
    expect(byKey('withdrawn-fees')?.approvalStatus).toBe('WITHDRAWN');
  });

  it('has an advisor-only document and one in tenant B', () => {
    expect(byKey('advisor-caseload')?.audience).toBe('ADVISOR');
    expect(byKey('other-tenant-parking')?.tenantId).toBe('10000000-0000-4000-8000-000000000002');
  });

  it('has two current documents with one subject and different text', () => {
    const a = byKey('repeat-limit-a');
    const b = byKey('repeat-limit-b');

    expect(a?.subjectKey).toBe('repeat-limit');
    expect(b?.subjectKey).toBe('repeat-limit');
    expect(a?.body).not.toBe(b?.body);
  });

  it('has one approved ALL referral per specialist topic, crisis included', () => {
    const referrals = corpus.filter((d) => d.documentKey.startsWith('referral-'));

    expect(referrals.map((d) => d.topic)).toEqual(Object.values(SpecialistTopic));
    expect(referrals.every((d) => d.audience === 'ALL' && d.approvalStatus === 'APPROVED')).toBe(
      true,
    );
    expect(byKey('referral-crisis')?.body).toContain('fictional Demo State Care Line');
  });

  it('has one document whose body contains a prompt injection', () => {
    expect(byKey('injected-note')?.body).toContain('Ignore all previous instructions');
  });
});
