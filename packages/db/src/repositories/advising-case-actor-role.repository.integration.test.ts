/**
 * @file Integration tests for the case event actor role: writes, the NULL-to-omitted read, the
 *   migration backfill, and that the append-only trigger still holds afterward (ADR-0013
 *   Amendment 1).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type CaseId,
  IdentityStatus,
  type InstitutionId,
  Role,
  type UserId,
  UserIdSchema,
} from '@caa/domain';

import type { Database } from '../client';
import { caseEventTable } from '../tables/case-event.table';
import { userIdentityTable } from '../tables/user-identity.table';
import { buildClaim, buildNewCase, buildResolve, insertCaseWorld } from '../testing/case-fixtures';
import { immutableRowRejectionOf } from '../testing/catalog-fixtures';
import { insertTenant, TEST_ISSUER, type TestDatabase } from '../testing/integration-fixtures';
import { openIsolatedTestDatabase } from '../testing/isolated-database';
import { createAdvisingCaseRepository } from './advising-case.repository';

const MIGRATION = fileURLToPath(
  new URL('../../migrations/0016_case_event_actor_role.sql', import.meta.url),
);

/** The backfill is the last statement of the migration, after the column and check. */
function backfillStatement(): string {
  const statements = readFileSync(MIGRATION, 'utf8').split('--> statement-breakpoint');
  return statements[statements.length - 1] ?? '';
}

describe('case event actor role', () => {
  let testDatabase: TestDatabase;

  beforeAll(async () => {
    testDatabase = await openIsolatedTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  const newWorld = async (db: Database, label: string) =>
    insertCaseWorld(db, await insertTenant(db), label);

  const insertAdmin = async (db: Database, tenantId: InstitutionId): Promise<UserId> => {
    const rows = await db
      .insert(userIdentityTable)
      .values({
        tenantId,
        issuer: TEST_ISSUER,
        subject: `synthetic-admin-${tenantId}`,
        roles: [Role.Admin],
        status: IdentityStatus.Active,
      })
      .returning({ id: userIdentityTable.id });
    return UserIdSchema.parse(rows[0]?.id);
  };

  const readRoles = async (caseId: CaseId) => {
    const rows = await testDatabase.db
      .select({ action: caseEventTable.action, actorRole: caseEventTable.actorRole })
      .from(caseEventTable)
      .where(eq(caseEventTable.caseId, caseId))
      .orderBy(caseEventTable.sequence);
    return rows.map((row) => `${row.action}:${String(row.actorRole)}`);
  };

  it('stores a given role and reads an unrecorded one as an omitted field', async () => {
    const { db } = testDatabase;
    const world = await newWorld(db, 'write');
    const repo = createAdvisingCaseRepository(db);
    const created = await repo.create(world.tenantId, {
      ...buildNewCase(world),
      actorRole: Role.Student,
    });
    if (created.status !== 'CREATED') {
      throw new Error('expected the case to be created');
    }
    const claimed = await repo.appendEvent(world.tenantId, created.case.id, {
      expectedSequence: 1,
      event: { ...buildClaim(world.userId), actorRole: Role.Admin },
    });
    const resolved = await repo.appendEvent(world.tenantId, created.case.id, {
      expectedSequence: 2,
      event: buildResolve(world.userId),
    });

    expect(created.event.actorRole).toBe('STUDENT');
    expect(claimed.status === 'APPENDED' && claimed.event.actorRole).toBe('ADMIN');
    expect(resolved.status === 'APPENDED' && resolved.event.actorRole).toBeUndefined();
    expect(await readRoles(created.case.id)).toEqual([
      'CREATE:STUDENT',
      'CLAIM:ADMIN',
      'RESOLVE:null',
    ]);
  });

  it('refuses a role outside STUDENT, ADVISOR and ADMIN', async () => {
    const { db } = testDatabase;
    const world = await newWorld(db, 'check');
    const created = await createAdvisingCaseRepository(db).create(
      world.tenantId,
      buildNewCase(world),
    );
    if (created.status !== 'CREATED') {
      throw new Error('expected the case to be created');
    }

    const bad = createAdvisingCaseRepository(db).appendEvent(world.tenantId, created.case.id, {
      expectedSequence: 1,
      event: { ...buildClaim(world.userId), actorRole: 'ROOT' as never },
    });

    await expect(bad).rejects.toThrow();
  });

  it('backfills rows written without a role, then still refuses UPDATE', async () => {
    const { db } = testDatabase;
    const advisorWorld = await newWorld(db, 'backfill-advisor');
    const adminWorld = await newWorld(db, 'backfill-admin');
    const admin = await insertAdmin(db, adminWorld.tenantId);
    const repo = createAdvisingCaseRepository(db);
    const open = async (world: typeof advisorWorld, actor: typeof world.userId) => {
      const created = await repo.create(world.tenantId, buildNewCase(world));
      if (created.status !== 'CREATED') {
        throw new Error('expected the case to be created');
      }
      await repo.appendEvent(world.tenantId, created.case.id, {
        expectedSequence: 1,
        event: buildClaim(actor),
      });
      return created.case.id;
    };
    const advisorCase = await open(advisorWorld, advisorWorld.userId);
    const adminCase = await open(adminWorld, admin);
    // NOTE: simulate rows written before the migration by clearing the role, as the migration
    // itself would find them.
    await db.transaction(async (tx) => {
      await tx.execute(sql`ALTER TABLE "case_event" DISABLE TRIGGER "case_event_immutable_row"`);
      await tx.execute(sql`UPDATE "case_event" SET "actor_role" = NULL`);
      await tx.execute(sql`ALTER TABLE "case_event" ENABLE TRIGGER "case_event_immutable_row"`);
    });

    await db.execute(sql.raw(backfillStatement()));

    expect((await readRoles(advisorCase))[0]).toBe('CREATE:STUDENT');
    expect((await readRoles(advisorCase))[1]).toBe('CLAIM:ADVISOR');
    expect((await readRoles(adminCase))[0]).toBe('CREATE:STUDENT');
    expect((await readRoles(adminCase))[1]).toBe('CLAIM:ADMIN');
    await expect(
      db
        .update(caseEventTable)
        .set({ actorRole: 'ADMIN' })
        .where(eq(caseEventTable.caseId, adminCase)),
    ).rejects.toMatchObject(immutableRowRejectionOf('case_event'));
  });
});
