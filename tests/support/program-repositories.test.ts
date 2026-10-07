/**
 * @file Proves the QA program repository fake follows the `@caa/db` contract: tenant-filtered,
 * and null for an unknown ID or another tenant's program.
 * @requirement FR-10
 * @see docs/standards/07-testing.md
 */
import { describe, expect, it } from 'vitest';

import { createProgram, ProgramIdSchema } from '@caa/domain';
import { SYNTHETIC_TENANTS, syntheticId } from '@caa/test-kit';

import { createProgramRepositories } from './program-repositories';

const TENANT_A = SYNTHETIC_TENANTS.a.id;
const TENANT_B = SYNTHETIC_TENANTS.b.id;
const ID_A = ProgramIdSchema.parse(syntheticId('program', 1));
const ID_B = ProgramIdSchema.parse(syntheticId('program', 2));
const OWN = createProgram({
  id: ID_A,
  tenantId: TENANT_A,
  sourceProgramId: 'SYN-PHYS-BS',
  name: 'B.S. Synthetic Physics',
});
const FOREIGN = createProgram({
  id: ID_B,
  tenantId: TENANT_B,
  sourceProgramId: 'SYN-PHYS-BS',
  name: null,
});

describe('program repository fake: findById', () => {
  const repos = createProgramRepositories({ programs: [FOREIGN, OWN] });

  it('finds the tenant program, including one whose catalog name is null', async () => {
    expect(await repos.programs.findById(TENANT_A, ID_A)).toEqual(OWN);
    expect(await repos.programs.findById(TENANT_B, ID_B)).toEqual(FOREIGN);
  });

  it("returns null for another tenant's program", async () => {
    expect(await repos.programs.findById(TENANT_A, ID_B)).toBeNull();
    expect(await repos.programs.findById(TENANT_B, ID_A)).toBeNull();
  });

  it('returns null for an unknown ID, and when no programs are stored', async () => {
    const unknown = ProgramIdSchema.parse(syntheticId('program', 99));
    expect(await repos.programs.findById(TENANT_A, unknown)).toBeNull();
    expect(await createProgramRepositories({}).programs.findById(TENANT_A, ID_A)).toBeNull();
  });

  it('reads the world again on each call', async () => {
    const world: { programs?: readonly (typeof OWN)[] } = {};
    const live = createProgramRepositories(world);
    expect(await live.programs.findById(TENANT_A, ID_A)).toBeNull();
    world.programs = [OWN];
    expect(await live.programs.findById(TENANT_A, ID_A)).toEqual(OWN);
  });
});
