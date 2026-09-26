/**
 * @file Synthetic fixtures for repository integration tests. Test code only; not exported.
 * @module @caa/db/testing/integration-fixtures
 * @see docs/standards/07-testing.md
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import {
  createImportBatch,
  IdentityStatus,
  type ImportBatch,
  type ImportBatchInput,
  ImportOperation,
  type InstitutionId,
  InstitutionIdSchema,
  Role,
  type StudentId,
  StudentIdSchema,
  type UserId,
  UserIdSchema,
} from '@caa/domain';

import type { Database } from '../client';
import * as schema from '../schema';
import { institutionTable } from '../tables/institution.table';
import { studentTable } from '../tables/student.table';
import { userIdentityTable } from '../tables/user-identity.table';

/** Issuer used by every synthetic identity. */
export const TEST_ISSUER = 'https://idp.demo-state.example';

/** A database handle plus the pool to close after the tests. */
export interface TestDatabase {
  readonly db: Database;
  readonly close: () => Promise<void>;
}

/**
 * Opens the per-run integration database that the global setup created and migrated.
 *
 * @returns The handle and a function that closes its pool.
 * @throws {Error} When DATABASE_URL is not set.
 */
export function openTestDatabase(): TestDatabase {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set; run these tests through the integration project');
  }
  const pool = new pg.Pool({ connectionString });
  return { db: drizzle({ client: pool, schema }), close: () => pool.end() };
}

/**
 * Inserts a fresh synthetic institution so each test owns its tenant.
 *
 * @param db - Database handle.
 * @returns The new tenant ID.
 */
export async function insertTenant(db: Database): Promise<InstitutionId> {
  const rows = await db
    .insert(institutionTable)
    .values({ name: 'Demo State University', timezone: 'America/Chicago' })
    .returning({ id: institutionTable.id });
  return InstitutionIdSchema.parse(rows[0]?.id);
}

/**
 * Inserts a synthetic user identity. The subject embeds the tenant so it is globally unique.
 *
 * @param db - Database handle.
 * @param tenantId - Owning tenant.
 * @param label - Distinguishes users within one tenant.
 * @returns The new user ID.
 */
export async function insertUser(
  db: Database,
  tenantId: InstitutionId,
  label: string,
): Promise<UserId> {
  const rows = await db
    .insert(userIdentityTable)
    .values({
      tenantId,
      issuer: TEST_ISSUER,
      subject: `synthetic-${tenantId}-${label}`,
      roles: [Role.Advisor],
      status: IdentityStatus.Active,
    })
    .returning({ id: userIdentityTable.id });
  return UserIdSchema.parse(rows[0]?.id);
}

/**
 * Inserts a synthetic student directly, bypassing the import path.
 *
 * @param db - Database handle.
 * @param tenantId - Owning tenant.
 * @param sourceStudentId - Fictional source ID.
 * @returns The new student ID.
 */
export async function insertStudent(
  db: Database,
  tenantId: InstitutionId,
  sourceStudentId: string,
): Promise<StudentId> {
  const rows = await db
    .insert(studentTable)
    .values({
      tenantId,
      sourceStudentId,
      recordVersion: null,
      sourceEffectiveAt: new Date('2026-09-01T00:00:00.000Z'),
    })
    .returning({ id: studentTable.id });
  return StudentIdSchema.parse(rows[0]?.id);
}

/**
 * Builds a valid synthetic batch envelope.
 *
 * @param tenantId - Owning tenant.
 * @param overrides - Fields to change from the defaults.
 * @returns The envelope.
 */
export function buildBatch(
  tenantId: InstitutionId,
  overrides: Partial<ImportBatchInput> = {},
): ImportBatch {
  return createImportBatch({
    tenantId,
    sourceId: 'demo-sis',
    schemaVersion: '1',
    batchId: 'batch-0001',
    extractedAt: '2026-09-25T07:00:00.000Z',
    sourceEffectiveAt: '2026-09-25T06:00:00.000Z',
    checksum: 'a'.repeat(64),
    recordCount: 0,
    operation: ImportOperation.Delta,
    ...overrides,
  });
}
