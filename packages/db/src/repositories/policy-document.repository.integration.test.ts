/**
 * @file Integration tests for the policy document repository against PostgreSQL.
 */
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { InstitutionId } from '@caa/domain';

import { policyDocumentTable } from '../tables/policy-document.table';
import { immutableRowRejectionOf } from '../testing/catalog-fixtures';
import { insertTenant, openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { createPolicyDocumentRepository } from './policy-document.repository';

const AS_OF = '2026-10-08T12:00:00.000Z';
const HASH = `sha256:${'b'.repeat(64)}`;

type NewDocument = typeof policyDocumentTable.$inferInsert;

function document(
  tenantId: InstitutionId,
  documentKey: string,
  overrides: Partial<NewDocument> = {},
): NewDocument {
  return {
    tenantId,
    documentKey,
    revision: 1,
    title: `Title of ${documentKey}`,
    body: 'Fictional approved text.',
    topic: 'GENERAL',
    subjectKey: documentKey,
    audience: 'STUDENT',
    effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
    effectiveTo: null,
    approvalStatus: 'APPROVED',
    approvedAt: new Date('2026-07-15T00:00:00.000Z'),
    sourceLabel: 'Fictional handbook',
    contentHash: HASH,
    ...overrides,
  };
}

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
      document(tenantId, 'c-withdrawn', { approvalStatus: 'WITHDRAWN', approvedAt: null }),
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
    expect(await keysFor(['ADVISOR'])).toEqual(['f-advisor']);
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

describe('policy_document table', () => {
  let testDatabase: TestDatabase;
  let tenantId: InstitutionId;

  beforeAll(async () => {
    testDatabase = openTestDatabase();
    tenantId = await insertTenant(testDatabase.db);
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  it('refuses to update or delete an approved row', async () => {
    const { db } = testDatabase;
    await db.insert(policyDocumentTable).values(document(tenantId, 'immutable'));
    const where = eq(policyDocumentTable.documentKey, 'immutable');

    await expect(
      db.update(policyDocumentTable).set({ title: 'Changed' }).where(where),
    ).rejects.toMatchObject(immutableRowRejectionOf('policy_document'));
    await expect(db.delete(policyDocumentTable).where(where)).rejects.toMatchObject(
      immutableRowRejectionOf('policy_document'),
    );
  });

  it('lets a draft be edited and then approved, after which it is frozen', async () => {
    const { db } = testDatabase;
    await db
      .insert(policyDocumentTable)
      .values(document(tenantId, 'draft-flow', { approvalStatus: 'DRAFT', approvedAt: null }));
    const where = eq(policyDocumentTable.documentKey, 'draft-flow');

    await db.update(policyDocumentTable).set({ title: 'Edited' }).where(where);
    await db
      .update(policyDocumentTable)
      .set({ approvalStatus: 'APPROVED', approvedAt: new Date('2026-07-15T00:00:00.000Z') })
      .where(where);

    await expect(
      db.update(policyDocumentTable).set({ title: 'Again' }).where(where),
    ).rejects.toMatchObject(immutableRowRejectionOf('policy_document'));
  });

  it('refuses a second row with the same tenant, key and revision', async () => {
    const { db } = testDatabase;
    await db.insert(policyDocumentTable).values(document(tenantId, 'unique-key'));

    await expect(
      db.insert(policyDocumentTable).values(document(tenantId, 'unique-key')),
    ).rejects.toThrow();
  });

  it('refuses an approved row without an approval time and an empty interval', async () => {
    const { db } = testDatabase;

    await expect(
      db
        .insert(policyDocumentTable)
        .values(document(tenantId, 'no-approval', { approvedAt: null })),
    ).rejects.toThrow();
    await expect(
      db.insert(policyDocumentTable).values(
        document(tenantId, 'empty-interval', {
          effectiveTo: new Date('2026-08-01T00:00:00.000Z'),
        }),
      ),
    ).rejects.toThrow();
  });

  it('refuses a truncate', async () => {
    // NOTE: rolled back either way, so a missing trigger fails this test without emptying
    // the table that other test files share.
    const truncate = testDatabase.db.transaction(async (tx) => {
      await tx.execute(sql`TRUNCATE TABLE policy_document`);
      tx.rollback();
    });

    await expect(truncate).rejects.toMatchObject(immutableRowRejectionOf('policy_document'));
  });
});
