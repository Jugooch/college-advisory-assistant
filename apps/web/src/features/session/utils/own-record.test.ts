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
 * @param studentId - The linked student, `null`, or omitted when undefined.
 * @returns The parsed response.
 */
function me(studentId: string | null | undefined): MeResponse {
  return MeResponseSchema.parse({
    userId: syntheticId('user', 1),
    tenantId: SYNTHETIC_TENANTS.a.id,
    roles: [Role.Student],
    ...(studentId === undefined ? {} : { studentId }),
  });
}

describe('ownOverviewPath', () => {
  it('points to the linked student’s overview', () => {
    expect(ownOverviewPath(me(STUDENT_ID))).toBe(`/overview?studentId=${STUDENT_ID}`);
  });

  it.each([
    ['no linked student', null],
    ['an API that does not report one yet', undefined],
  ])('is null for %s, so the lookup form stays', (_name, studentId) => {
    expect(ownOverviewPath(me(studentId))).toBeNull();
  });
});
