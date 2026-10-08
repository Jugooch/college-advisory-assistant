/**
 * @file Integration tests for the policy document repository against PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { InstitutionId } from '@caa/domain';

import { policyDocumentTable } from '../tables/policy-document.table';
import { insertTenant, openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { policyDocumentRow as document } from '../testing/policy-document-fixtures';
import { createPolicyDocumentRepository } from './policy-document.repository';

const AS_OF = '2026-10-08T12:00:00.000Z';

describe('PolicyDocumentRepository.listApplicable', () => {
  let testDatabase: TestDatabase;
  let tenantId: InstitutionId;
  let otherTenantId: InstitutionId;

  beforeAll(async () => {
    testDatabase = openTestDatabase();
    const { db } = testDatabase;
    tenantId = await insertTenant(db);
    otherTenantId = await insertTenant(db);
    await db.insert(policyDocumentTable).values([
      document(tenantId, 'a-current'),
      document(tenantId, 'b-draft', { approvalStatus: 'DRAFT', approvedAt: null }),
      document(tenantId, 'c-withdrawn', {
        approvalStatus: 'WITHDRAWN',
        approvedAt: null,
        withdrawnAt: new Date('2026-07-20T00:00:00.000Z'),
      }),
      document(tenantId, 'd-expired', { effectiveTo: new Date('2026-09-01T00:00:00.000Z') }),
      document(tenantId, 'e-future', { effectiveFrom: new Date('2026-11-01T00:00:00.000Z') }),
      document(tenantId, 'f-advisor', { audience: 'ADVISOR' }),
      document(tenantId, 'g-ends-at-as-of', { effectiveTo: new Date(AS_OF) }),
      document(tenantId, 'h-starts-at-as-of', { effectiveFrom: new Date(AS_OF) }),
      document(tenantId, 'i-revised', { revision: 1, body: 'Old text.' }),
      document(tenantId, 'i-revised', {
        revision: 2,
        body: 'New text.',
        effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
      }),
      document(tenantId, 'i-revised', {
        revision: 3,
        body: 'Not yet.',
        effectiveFrom: new Date('2026-12-01T00:00:00.000Z'),
      }),
      document(tenantId, 'j-everyone', { audience: 'ALL' }),
      document(tenantId, 'k-narrowed', { revision: 1, body: 'Old student text.' }),
      document(tenantId, 'k-narrowed', {
        revision: 2,
        audience: 'ADVISOR',
        body: 'Advisor only.',
        effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
      }),
      document(tenantId, 'l-widened', { revision: 1, audience: 'ADVISOR' }),
      document(tenantId, 'l-widened', {
        revision: 2,
        audience: 'STUDENT',
        effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
      }),
      document(otherTenantId, 'z-other-tenant'),
    ]);
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  async function keysFor(audiences: readonly ('STUDENT' | 'ADVISOR' | 'ALL')[]) {
    const documents = await createPolicyDocumentRepository(testDatabase.db).listApplicable({
      tenantId,
      audiences,
      asOf: AS_OF,
    });
    return documents.map((doc) => doc.documentKey);
  }

  it('returns only approved, effective documents for the audience, ordered by key', async () => {
    expect(await keysFor(['STUDENT', 'ALL'])).toEqual([
      'a-current',
      'h-starts-at-as-of',
      'i-revised',
      'j-everyone',
      'l-widened',
    ]);
  });

  it('never returns a draft or a withdrawn document', async () => {
    const keys = await keysFor(['STUDENT', 'ADVISOR', 'ALL']);

    expect(keys).not.toContain('b-draft');
    expect(keys).not.toContain('c-withdrawn');
  });

  it('excludes expired and not-yet-effective documents', async () => {
    const keys = await keysFor(['STUDENT', 'ALL']);

    expect(keys).not.toContain('d-expired');
    expect(keys).not.toContain('e-future');
  });

  it('excludes a document whose effectiveTo equals asOf and includes one whose effectiveFrom does', async () => {
    const keys = await keysFor(['STUDENT']);

    expect(keys).not.toContain('g-ends-at-as-of');
    expect(keys).toContain('h-starts-at-as-of');
  });

  it('excludes documents for audiences that were not asked for', async () => {
    expect(await keysFor(['ADVISOR'])).toEqual(['f-advisor', 'k-narrowed']);
    expect(await keysFor([])).toEqual([]);
  });

  it('returns the highest effective revision of a document key', async () => {
    const documents = await createPolicyDocumentRepository(testDatabase.db).listApplicable({
      tenantId,
      audiences: ['STUDENT'],
      asOf: AS_OF,
    });

    const revised = documents.filter((doc) => doc.documentKey === 'i-revised');
    expect(revised.map((doc) => [doc.revision, doc.body])).toEqual([[2, 'New text.']]);
  });

  it('returns nothing to a student when the current revision is advisor-only', async () => {
    const keys = await keysFor(['STUDENT', 'ALL']);

    expect(keys).not.toContain('k-narrowed');
  });

  it('returns the advisor-only current revision, not the older student one, to advisors', async () => {
    const documents = await createPolicyDocumentRepository(testDatabase.db).listApplicable({
      tenantId,
      audiences: ['ADVISOR'],
      asOf: AS_OF,
    });

    const narrowed = documents.filter((doc) => doc.documentKey === 'k-narrowed');
    expect(narrowed.map((doc) => [doc.revision, doc.body])).toEqual([[2, 'Advisor only.']]);
  });

  it('returns a student the current revision when an advisor-only revision was widened', async () => {
    const documents = await createPolicyDocumentRepository(testDatabase.db).listApplicable({
      tenantId,
      audiences: ['STUDENT'],
      asOf: AS_OF,
    });

    const widened = documents.filter((doc) => doc.documentKey === 'l-widened');
    expect(widened.map((doc) => doc.revision)).toEqual([2]);
  });

  it("never returns another tenant's document", async () => {
    const repository = createPolicyDocumentRepository(testDatabase.db);

    const mine = await repository.listApplicable({ tenantId, audiences: ['STUDENT'], asOf: AS_OF });
    const theirs = await repository.listApplicable({
      tenantId: otherTenantId,
      audiences: ['STUDENT'],
      asOf: AS_OF,
    });

    expect(mine.map((doc) => doc.documentKey)).not.toContain('z-other-tenant');
    expect(theirs.map((doc) => doc.documentKey)).toEqual(['z-other-tenant']);
  });

  it('rejects an invalid instant', async () => {
    await expect(
      createPolicyDocumentRepository(testDatabase.db).listApplicable({
        tenantId,
        audiences: ['STUDENT'],
        asOf: 'not-a-date',
      }),
    ).rejects.toThrow(RangeError);
  });
});
