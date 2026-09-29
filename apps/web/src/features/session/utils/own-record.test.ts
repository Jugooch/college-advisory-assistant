/**
 * @file Tests that only a session with a linked student leads to that student's own overview.
 */
import { describe, expect, it } from 'vitest';

import { type MeResponse, MeResponseSchema } from '@caa/api-contract';
import { Role } from '@caa/domain';
import { SYNTHETIC_TENANTS, syntheticId } from '@caa/test-kit';

import { ownOverviewPath } from './own-record';

const STUDENT_ID = syntheticId('student', 1);

/**
 * Builds a contract-valid `/v1/me` response.
 *
 * @param studentId - The linked student, or `null` when the user has none.
 * @returns The parsed response.
 */
function me(studentId: string | null): MeResponse {
  return MeResponseSchema.parse({
    userId: syntheticId('user', 1),
    tenantId: SYNTHETIC_TENANTS.a.id,
    roles: [Role.Student],
    studentId,
  });
}

/**
 * Removes `studentId` from a response.
 *
 * @param response - A full response.
 * @returns The same response without the `studentId` key.
 */
function withoutStudentId(response: MeResponse): MeResponse {
  const entries = Object.entries(response).filter(([key]) => key !== 'studentId');
  // NOTE: simulates an older API that doesn't report `studentId`. The cast compiles, and is
  // needed, whether the contract has the field as optional or required.
  return Object.fromEntries(entries) as MeResponse;
}

describe('ownOverviewPath', () => {
  it('points to the linked student’s overview', () => {
    expect(ownOverviewPath(me(STUDENT_ID))).toBe(`/overview?studentId=${STUDENT_ID}`);
  });

  it.each([
    ['no linked student', me(null)],
    ['an API that does not report one', withoutStudentId(me(STUDENT_ID))],
  ])('is null for %s, so the lookup form stays', (_name, response) => {
    expect(ownOverviewPath(response)).toBeNull();
  });
});
