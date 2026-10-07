/**
 * @file QA-owned in-memory program repository for the API acceptance harness. It follows the
 * documented `@caa/db` repository contract, written here from that contract and not copied from
 * anyone's fakes, so the acceptance oracle stays independent of the code under test
 * (docs/standards/07-testing.md, Acceptance tests).
 * @module @caa/tests/support/program-repositories
 * @requirement FR-10
 * @see docs/standards/07-testing.md
 */
import type { ProgramRepository } from '@caa/db';
import type { Program } from '@caa/domain';

/** Program backing data. A field that is omitted means nothing of that kind is stored. */
export interface ProgramWorld {
  /** Programs of every tenant. */
  programs?: readonly Program[];
}

/** The program repository the harness gives the API's `Repositories` under the `programs` key. */
export interface ProgramRepositories {
  readonly programs: ProgramRepository;
}

/**
 * Creates the program repository over the world. As the repository contract states, a program of
 * another tenant, or an unknown ID, is null.
 *
 * @param world - Backing data. Read on every call, so a case can change it between requests.
 * @returns The program repositories.
 */
export function createProgramRepositories(world: ProgramWorld): ProgramRepositories {
  return {
    programs: {
      findById: (tenantId, programId) =>
        Promise.resolve(
          (world.programs ?? []).find(
            (program) => program.tenantId === tenantId && program.id === programId,
          ) ?? null,
        ),
    },
  };
}
