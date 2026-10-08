/**
 * @file Tests for the synthetic policy corpus the dev seed writes.
 */
import { describe, expect, it } from 'vitest';

import { PolicyApprovalStatus, PolicyAudience, PolicyTopic, SpecialistTopic } from '@caa/domain';

import { SEED_POLICY_DOCUMENTS } from './dev-seed-policy-plan';

const OTHER_TENANT = '10000000-0000-4000-8000-000000000002';
const inDevTenant = SEED_POLICY_DOCUMENTS.filter((doc) => doc.tenantId !== OTHER_TENANT);

describe('SEED_POLICY_DOCUMENTS', () => {
  it('has a unique id and a unique tenant, key and revision for every document', () => {
    const ids = new Set(SEED_POLICY_DOCUMENTS.map((doc) => doc.id));
    const keys = new Set(
      SEED_POLICY_DOCUMENTS.map((doc) => [doc.tenantId, doc.documentKey, doc.revision].join('/')),
    );

    expect(ids.size).toBe(SEED_POLICY_DOCUMENTS.length);
    expect(keys.size).toBe(SEED_POLICY_DOCUMENTS.length);
  });

  it('holds one approved referral document for every specialist topic', () => {
    const topics = inDevTenant
      .filter((doc) => doc.approvalStatus === PolicyApprovalStatus.Approved)
      .map((doc) => doc.topic);

    for (const topic of Object.values(SpecialistTopic)) {
      expect(topics.filter((candidate) => candidate === topic)).toHaveLength(1);
    }
  });

  it('holds draft, withdrawn, advisor-only, other-tenant and injection documents', () => {
    const statuses = SEED_POLICY_DOCUMENTS.map((doc) => doc.approvalStatus);

    expect(statuses).toContain(PolicyApprovalStatus.Draft);
    expect(statuses).toContain(PolicyApprovalStatus.Withdrawn);
    expect(SEED_POLICY_DOCUMENTS.some((doc) => doc.audience === PolicyAudience.Advisor)).toBe(true);
    expect(SEED_POLICY_DOCUMENTS.some((doc) => doc.tenantId === OTHER_TENANT)).toBe(true);
    expect(SEED_POLICY_DOCUMENTS.some((doc) => /ignore all previous/i.test(doc.body))).toBe(true);
  });

  it('holds two documents that share a subject key and disagree', () => {
    const refunds = inDevTenant.filter((doc) => doc.subjectKey === 'tuition-refund');

    expect(refunds).toHaveLength(2);
    expect(new Set(refunds.map((doc) => doc.body)).size).toBe(2);
  });

  it('names a fictional number in the crisis document', () => {
    const crisis = inDevTenant.find((doc) => doc.topic === PolicyTopic.Crisis);

    expect(crisis?.body).toContain('555-0100');
  });
});
