/**
 * @file Integration tests for the policy_document table constraints and triggers.
 */
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { InstitutionId } from '@caa/domain';

import { policyDocumentTable } from '../tables/policy-document.table';
import { immutableRowRejectionOf } from '../testing/catalog-fixtures';
import { insertTenant, openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { policyDocumentRow as document } from '../testing/policy-document-fixtures';

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
