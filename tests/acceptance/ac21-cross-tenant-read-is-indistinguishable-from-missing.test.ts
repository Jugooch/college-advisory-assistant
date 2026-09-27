/**
 * @file Acceptance: an actor in tenant A who asks for a tenant B student gets 404, and the
 * response is identical to the one for a student that doesn't exist.
 * @requirement FR-01
 * @requirement FR-02
 * @requirement T01
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/standards/09-errors-logging-and-security.md
 */
import { describe, expect, it } from 'vitest';

import { Role } from '@caa/domain';
import {
  buildAdvisorAssignment,
  buildStudent,
  buildUserIdentity,
  SYNTHETIC_TENANTS,
} from '@caa/test-kit';

import { buildAcceptanceApp, getAs, summarizeError } from '../support/api-harness';

const ADMIN_A = buildUserIdentity({ roles: [Role.Admin] }, 11);
const ADVISOR_A = buildUserIdentity({ roles: [Role.Advisor] }, 12);
const STUDENT_B = buildStudent({ tenantId: SYNTHETIC_TENANTS.b.id }, 21);
const TENANT_B_STUDENT_URL = '/v1/students/30000000-0000-4000-8000-000000000015';
const MISSING_STUDENT_URL = '/v1/students/30000000-0000-4000-8000-0000000003e7';

const app = buildAcceptanceApp(
  {
    identities: [ADMIN_A, ADVISOR_A],
    students: [STUDENT_B],
    // SECURITY: a mis-scoped grant that names the tenant B student must not open it to tenant A.
    assignments: [
      buildAdvisorAssignment({
        tenantId: SYNTHETIC_TENANTS.a.id,
        advisorUserId: ADVISOR_A.id,
        studentId: STUDENT_B.id,
      }),
    ],
  },
  [
    { token: 'ac21-admin-a', identity: ADMIN_A },
    { token: 'ac21-advisor-a', identity: ADVISOR_A },
  ],
);

describe('AC21 cross-tenant student read', () => {
  it.each([
    ['admin', 'ac21-admin-a'],
    ['advisor holding a grant that names the student', 'ac21-advisor-a'],
  ])('returns 404 NOT_FOUND to a tenant A %s', async (_actor, token) => {
    const response = await getAs(app, TENANT_B_STUDENT_URL, `Bearer ${token}`);

    expect(summarizeError(response)).toMatchObject({
      statusCode: 404,
      bodyKeys: ['error'],
      errorKeys: ['code', 'message', 'requestId'],
      code: 'NOT_FOUND',
    });
  });

  it.each(['ac21-admin-a', 'ac21-advisor-a'])(
    'answers %s exactly as it would for a student that does not exist',
    async (token) => {
      const crossTenant = await getAs(app, TENANT_B_STUDENT_URL, `Bearer ${token}`);
      const missing = await getAs(app, MISSING_STUDENT_URL, `Bearer ${token}`);

      expect(summarizeError(crossTenant)).toEqual(summarizeError(missing));
    },
  );

  it('never echoes the tenant B student identifiers or tenant in the response', async () => {
    const response = await getAs(app, TENANT_B_STUDENT_URL, 'Bearer ac21-admin-a');
    const text = JSON.stringify(response.body);

    expect(text).not.toContain('30000000-0000-4000-8000-000000000015');
    expect(text).not.toContain('SYN-000021');
    expect(text).not.toContain('10000000-0000-4000-8000-000000000002');
  });
});
