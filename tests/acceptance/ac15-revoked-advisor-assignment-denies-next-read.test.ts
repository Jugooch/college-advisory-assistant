/**
 * @file Acceptance: once an advisor assignment is revoked, the advisor's next read of that student
 * is denied, within the same session.
 * @requirement FR-02
 * @requirement T01
 * @requirement AC15
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, expect, it } from 'vitest';

import { Role } from '@caa/domain';
import { buildAdvisorAssignment, buildStudent, buildUserIdentity } from '@caa/test-kit';

import {
  type AcceptanceWorld,
  buildAcceptanceApp,
  getAs,
  summarizeError,
} from '../support/api-harness';

const ADVISOR = buildUserIdentity({ roles: [Role.Advisor] }, 2);
const STUDENT = buildStudent({}, 1);
const ADVISOR_TOKEN = 'ac15-advisor-token';
const STUDENT_URL = '/v1/students/30000000-0000-4000-8000-000000000001';

/**
 * Builds a world where the advisor holds an open-ended assignment to the student.
 *
 * @returns The mutable world.
 */
function assignedWorld(): AcceptanceWorld {
  return {
    identities: [ADVISOR],
    students: [STUDENT],
    assignments: [buildAdvisorAssignment({ advisorUserId: ADVISOR.id, studentId: STUDENT.id })],
  };
}

describe('AC15 advisor assignment revoked mid-session', () => {
  it('lets the assigned advisor read the student before revocation', async () => {
    const world = assignedWorld();
    const app = buildAcceptanceApp(world, [{ token: ADVISOR_TOKEN, identity: ADVISOR }]);

    const response = await getAs(app, STUDENT_URL, `Bearer ${ADVISOR_TOKEN}`);

    expect(response).toEqual({
      statusCode: 200,
      body: { data: { id: '30000000-0000-4000-8000-000000000001', sourceStudentId: 'SYN-000001' } },
    });
  });

  it('denies the next read with 404 once the assignment has ended', async () => {
    const world = assignedWorld();
    const app = buildAcceptanceApp(world, [{ token: ADVISOR_TOKEN, identity: ADVISOR }]);
    await getAs(app, STUDENT_URL, `Bearer ${ADVISOR_TOKEN}`);

    world.assignments = [
      buildAdvisorAssignment({
        advisorUserId: ADVISOR.id,
        studentId: STUDENT.id,
        effectiveTo: '2026-09-01T11:00:00.000Z',
      }),
    ];
    const response = await getAs(app, STUDENT_URL, `Bearer ${ADVISOR_TOKEN}`);

    expect(summarizeError(response)).toMatchObject({
      statusCode: 404,
      bodyKeys: ['error'],
      errorKeys: ['code', 'message', 'requestId'],
      code: 'NOT_FOUND',
    });
  });

  it('denies the next read with 404 once the assignment is removed', async () => {
    const world = assignedWorld();
    const app = buildAcceptanceApp(world, [{ token: ADVISOR_TOKEN, identity: ADVISOR }]);
    await getAs(app, STUDENT_URL, `Bearer ${ADVISOR_TOKEN}`);

    world.assignments = [];
    const response = await getAs(app, STUDENT_URL, `Bearer ${ADVISOR_TOKEN}`);

    expect(response.statusCode).toBe(404);
  });
});
