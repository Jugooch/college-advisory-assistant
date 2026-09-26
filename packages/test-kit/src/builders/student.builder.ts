/**
 * @file Builds synthetic students for tests.
 * @module @caa/test-kit/builders/student
 */
import { createStudent, type Student, type StudentInput } from '@caa/domain';

import { syntheticId, syntheticSourceStudentId } from '../fixtures/synthetic-id';
import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';

/**
 * Builds a valid student in tenant A with no linked login (`userId: null`). With the same seed,
 * `sourceStudentId` matches the one from `buildRosterRow`.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes students; drives the default `id` and `sourceStudentId`.
 * @returns A validated student.
 */
export function buildStudent(overrides: Partial<StudentInput> = {}, seed = 1): Student {
  return createStudent({
    id: syntheticId('student', seed),
    tenantId: SYNTHETIC_TENANTS.a.id,
    sourceStudentId: syntheticSourceStudentId(seed),
    userId: null,
    ...overrides,
  });
}
