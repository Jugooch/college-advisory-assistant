/**
 * @file Integration tests for the program repository against PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ProgramIdSchema } from '@caa/domain';

import { programTable } from '../tables/program.table';
import { violationOf } from '../testing/catalog-fixtures';
import { insertTenant, openTestDatabase, type TestDatabase } from '../testing/integration-fixtures';
import { createProgramRepository } from './program.repository';

describe('ProgramRepository.findById', () => {
  let testDatabase: TestDatabase;

  beforeAll(() => {
    testDatabase = openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  /**
   * Inserts a synthetic program.
   *
   * @param tenantId - Owning tenant.
   * @param name - Catalog name, or null.
   * @param sourceProgramId - Source program ID.
   * @returns The new program's ID.
   */
  async function insertProgram(tenantId: string, name: string | null, sourceProgramId = 'DEMO-BS') {
    const rows = await testDatabase.db
      .insert(programTable)
      .values({ tenantId, sourceProgramId, name })
      .returning({ id: programTable.id });
    return ProgramIdSchema.parse(rows[0]?.id);
  }

  it('round-trips a program name, and keeps a null name as null', async () => {
    const { db } = testDatabase;
    const tenantId = await insertTenant(db);
    const named = await insertProgram(tenantId, 'Demo B.S. Physics');
    const unnamed = await insertProgram(tenantId, null, 'DEMO-BA');
    const repository = createProgramRepository(db);

    expect(await repository.findById(tenantId, named)).toEqual({
      id: named,
      tenantId,
      sourceProgramId: 'DEMO-BS',
      name: 'Demo B.S. Physics',
    });
    expect((await repository.findById(tenantId, unnamed))?.name).toBeNull();
  });

  it("does not return another tenant's program", async () => {
    const { db } = testDatabase;
    const tenantA = await insertTenant(db);
    const tenantB = await insertTenant(db);
    const programOfB = await insertProgram(tenantB, 'Demo B.S. Physics');

    expect(await createProgramRepository(db).findById(tenantA, programOfB)).toBeNull();
  });

  it('rejects an empty name, because unknown is stored as null', async () => {
    const { db } = testDatabase;
    const tenantId = await insertTenant(db);

    await expect(insertProgram(tenantId, '')).rejects.toMatchObject(
      violationOf('program_name_not_empty'),
    );
  });
});
