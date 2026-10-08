/**
 * @file Integration tests for the changes the database refuses on approved and withdrawn policy revisions.
 */
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { InstitutionId } from '@caa/domain';

import { policyDocumentTable } from '../tables/policy-document.table';
import { immutableRowRejectionOf, violationOf } from '../testing/catalog-fixtures';
import { insertTenant, openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { policyDocumentRow as document } from '../testing/policy-document-fixtures';

describe('policy_document retraction refusals', () => {
  const RETRACTED_AT = new Date('2026-09-10T00:00:00.000Z');
  let testDatabase: TestDatabase;
  let tenantId: InstitutionId;

  beforeAll(async () => {
    testDatabase = openTestDatabase();
    tenantId = await insertTenant(testDatabase.db);
  });

  afterAll(async () => {
    await testDatabase.close();
  });
  const rejected = immutableRowRejectionOf('policy_document');

  async function insertApproved(key: string) {
    await testDatabase.db.insert(policyDocumentTable).values(document(tenantId, key));
    return eq(policyDocumentTable.documentKey, key);
  }

  async function insertRetracted(key: string) {
    const where = await insertApproved(key);
    await testDatabase.db
      .update(policyDocumentTable)
      .set({ approvalStatus: 'WITHDRAWN', withdrawnAt: RETRACTED_AT })
      .where(where);
    return where;
  }

  const retraction = { approvalStatus: 'WITHDRAWN', withdrawnAt: RETRACTED_AT } as const;

  it.each([
    ['body', { body: 'Changed.' }],
    ['title', { title: 'Changed' }],
    ['effective_to', { effectiveTo: new Date('2027-01-01T00:00:00.000Z') }],
    ['approved_at', { approvedAt: new Date('2026-07-16T00:00:00.000Z') }],
    ['content_hash', { contentHash: `sha256:${'c'.repeat(64)}` }],
  ])('refuses a retraction that also changes %s', async (column, change) => {
    const where = await insertApproved(`retract-and-${column}`);

    await expect(
      testDatabase.db
        .update(policyDocumentTable)
        .set({ ...retraction, ...change })
        .where(where),
    ).rejects.toMatchObject(rejected);
  });

  it('refuses to move an approved row back to draft', async () => {
    const where = await insertApproved('approved-to-draft');

    await expect(
      testDatabase.db
        .update(policyDocumentTable)
        .set({ approvalStatus: 'DRAFT', approvedAt: null })
        .where(where),
    ).rejects.toMatchObject(rejected);
  });

  it.each([
    ['approved', { approvalStatus: 'APPROVED', withdrawnAt: null }],
    ['draft', { approvalStatus: 'DRAFT', approvedAt: null, withdrawnAt: null }],
    ['edited', { body: 'Changed after withdrawal.' }],
  ] as const)('refuses to turn a withdrawn row into %s', async (name, change) => {
    const where = await insertRetracted(`withdrawn-to-${name}`);

    await expect(
      testDatabase.db.update(policyDocumentTable).set(change).where(where),
    ).rejects.toMatchObject(rejected);
  });

  it('refuses to delete an approved or a withdrawn row', async () => {
    const approved = await insertApproved('delete-approved');
    const withdrawn = await insertRetracted('delete-withdrawn');

    await expect(testDatabase.db.delete(policyDocumentTable).where(approved)).rejects.toMatchObject(
      rejected,
    );
    await expect(
      testDatabase.db.delete(policyDocumentTable).where(withdrawn),
    ).rejects.toMatchObject(rejected);
  });

  it('refuses a withdrawn row without a withdrawal time', async () => {
    await expect(
      testDatabase.db
        .insert(policyDocumentTable)
        .values(document(tenantId, 'no-withdrawn-at', { approvalStatus: 'WITHDRAWN' })),
    ).rejects.toMatchObject(violationOf('policy_document_times_match_status'));
  });

  it('refuses an approved row with a withdrawal time and a draft with an approval time', async () => {
    await expect(
      testDatabase.db
        .insert(policyDocumentTable)
        .values(document(tenantId, 'approved-withdrawn-at', { withdrawnAt: RETRACTED_AT })),
    ).rejects.toMatchObject(violationOf('policy_document_times_match_status'));
    await expect(
      testDatabase.db
        .insert(policyDocumentTable)
        .values(document(tenantId, 'draft-approved-at', { approvalStatus: 'DRAFT' })),
    ).rejects.toMatchObject(violationOf('policy_document_times_match_status'));
  });

  it('still lets a draft be edited, deleted and approved', async () => {
    const { db } = testDatabase;
    await db
      .insert(policyDocumentTable)
      .values([
        document(tenantId, 'draft-ok', { approvalStatus: 'DRAFT', approvedAt: null }),
        document(tenantId, 'draft-gone', { approvalStatus: 'DRAFT', approvedAt: null }),
      ]);
    const ok = eq(policyDocumentTable.documentKey, 'draft-ok');

    await db.update(policyDocumentTable).set({ body: 'Edited draft.' }).where(ok);
    await db
      .update(policyDocumentTable)
      .set({ approvalStatus: 'APPROVED', approvedAt: new Date('2026-07-15T00:00:00.000Z') })
      .where(ok);
    await db.delete(policyDocumentTable).where(eq(policyDocumentTable.documentKey, 'draft-gone'));

    const left = await db
      .select({ key: policyDocumentTable.documentKey })
      .from(policyDocumentTable)
      .where(sql`${policyDocumentTable.documentKey} IN ('draft-ok', 'draft-gone')`);
    expect(left).toEqual([{ key: 'draft-ok' }]);
  });
});
