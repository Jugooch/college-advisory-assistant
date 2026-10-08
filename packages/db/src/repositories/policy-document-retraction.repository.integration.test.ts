/**
 * @file Integration tests for retracting approved policy revisions and picking the current one.
 */
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { InstitutionId } from '@caa/domain';

import { policyDocumentTable } from '../tables/policy-document.table';
import { insertTenant, openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import {
  POLICY_HASH as HASH,
  policyDocumentRow as document,
} from '../testing/policy-document-fixtures';
import { createPolicyDocumentRepository } from './policy-document.repository';

describe('policy_document retraction', () => {
  const RETRACT_AS_OF = '2026-09-15T12:00:00.000Z';
  const RETRACTED_AT = new Date('2026-09-10T00:00:00.000Z');
  const SEPTEMBER = new Date('2026-09-01T00:00:00.000Z');
  let testDatabase: TestDatabase;
  let tenantId: InstitutionId;

  beforeAll(async () => {
    testDatabase = openTestDatabase();
    const { db } = testDatabase;
    tenantId = await insertTenant(db);
    await db.insert(policyDocumentTable).values([
      document(tenantId, 'k-retract', { revision: 1 }),
      document(tenantId, 'k-retract', { revision: 2, effectiveFrom: SEPTEMBER, body: 'R2 text.' }),
      document(tenantId, 'k-expire', { revision: 1 }),
      document(tenantId, 'k-expire', {
        revision: 2,
        effectiveFrom: SEPTEMBER,
        effectiveTo: new Date('2026-09-10T00:00:00.000Z'),
      }),
      document(tenantId, 'k-future', { revision: 1 }),
      document(tenantId, 'k-future', {
        revision: 2,
        effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
      }),
      document(tenantId, 'k-draft-withdrawn', { revision: 1 }),
      document(tenantId, 'k-draft-withdrawn', {
        revision: 2,
        effectiveFrom: SEPTEMBER,
        approvalStatus: 'WITHDRAWN',
        approvedAt: null,
        withdrawnAt: RETRACTED_AT,
      }),
      document(tenantId, 'k-readd', { revision: 1 }),
      document(tenantId, 'k-readd', { revision: 2, effectiveFrom: SEPTEMBER }),
      document(tenantId, 'k-readd', {
        revision: 3,
        effectiveFrom: new Date('2026-09-05T00:00:00.000Z'),
        body: 'R3 text.',
      }),
      document(tenantId, 'k-aud', { revision: 1, audience: 'STUDENT' }),
      document(tenantId, 'k-aud', { revision: 2, audience: 'ADVISOR', effectiveFrom: SEPTEMBER }),
    ]);
    const retract = (key: string, revision: number) =>
      db
        .update(policyDocumentTable)
        .set({ approvalStatus: 'WITHDRAWN', withdrawnAt: RETRACTED_AT })
        .where(
          sql`${policyDocumentTable.documentKey} = ${key} AND ${policyDocumentTable.revision} = ${revision}`,
        );
    await retract('k-retract', 2);
    await retract('k-readd', 2);
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  async function applicable(audiences: readonly ('STUDENT' | 'ADVISOR' | 'ALL')[]) {
    return createPolicyDocumentRepository(testDatabase.db).listApplicable({
      tenantId,
      audiences,
      asOf: RETRACT_AS_OF,
    });
  }

  function revisionOf(documents: Awaited<ReturnType<typeof applicable>>, key: string) {
    return documents.find((doc) => doc.documentKey === key)?.revision;
  }

  it('returns nothing for a key whose newest revision was retracted, not the older one', async () => {
    const documents = await applicable(['STUDENT']);

    expect(revisionOf(documents, 'k-retract')).toBeUndefined();
  });

  it('keeps a retracted revision as it was approved, apart from its status and withdrawal time', async () => {
    const [row] = await testDatabase.db
      .select()
      .from(policyDocumentTable)
      .where(
        sql`${policyDocumentTable.documentKey} = 'k-retract' AND ${policyDocumentTable.revision} = 2`,
      );

    expect(row).toMatchObject({
      approvalStatus: 'WITHDRAWN',
      body: 'R2 text.',
      contentHash: HASH,
      approvedAt: new Date('2026-07-15T00:00:00.000Z'),
      withdrawnAt: RETRACTED_AT,
    });
  });

  it('returns nothing for a key whose newest revision has expired, not the older one', async () => {
    expect(revisionOf(await applicable(['STUDENT']), 'k-expire')).toBeUndefined();
  });

  it('keeps the older revision while the newer one has not started', async () => {
    expect(revisionOf(await applicable(['STUDENT']), 'k-future')).toBe(1);
  });

  it('ignores a withdrawn draft, which was never published', async () => {
    expect(revisionOf(await applicable(['STUDENT']), 'k-draft-withdrawn')).toBe(1);
  });

  it('returns a newer revision approved after a retraction', async () => {
    const documents = await applicable(['STUDENT']);

    expect(revisionOf(documents, 'k-readd')).toBe(3);
  });

  it('gives a student nothing when the current revision is advisor-only', async () => {
    expect(revisionOf(await applicable(['STUDENT']), 'k-aud')).toBeUndefined();
    expect(revisionOf(await applicable(['ADVISOR']), 'k-aud')).toBe(2);
  });
});
