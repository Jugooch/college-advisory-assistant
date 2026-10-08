/**
 * @file Service tests for the advisor and admin case queue with injected fakes: only assigned
 * cases for an advisor, assignments evaluated at the injected clock, the admin-only unrouted
 * view, oldest first, and a log line with no note.
 * @requirement FR-02
 * @requirement FR-12
 * @requirement FR-14
 */
import { describe, expect, it } from 'vitest';

import { CaseStatus, Role, StudentIdSchema } from '@caa/domain';
import {
  buildActor,
  buildAdvisingCase,
  buildAdvisorAssignment,
  buildInReviewAdvisingCase,
  syntheticId,
} from '@caa/test-kit';

import { NotFoundError } from '../../shared/domain-errors';
import { createInMemoryCaseRepository } from '../../testing/in-memory-case-repositories';
import { createRecordingLogger } from '../../testing/in-memory-repositories';
import { createCaseQueueService } from './case-queue.service';

const NOW = new Date('2026-09-01T12:00:00.000Z');
const advisor = buildActor({ roles: [Role.Advisor] }, 2);
const admin = buildActor({ roles: [Role.Admin] }, 3);
const student = buildActor({ roles: [Role.Student] }, 1);
const assignedStudent = StudentIdSchema.parse(syntheticId('student', 1));
const strangerStudent = StudentIdSchema.parse(syntheticId('student', 2));
const assigned = buildAdvisingCase(
  { studentId: assignedStudent, createdAt: '2026-09-01T09:00:00.000Z' },
  1,
);
const inReview = buildInReviewAdvisingCase(
  { studentId: assignedStudent, createdAt: '2026-09-01T07:00:00.000Z' },
  2,
);
const unrouted = buildAdvisingCase(
  { studentId: strangerStudent, createdAt: '2026-09-01T08:00:00.000Z' },
  3,
);

/**
 * Builds the service over a store with one assignment, from the advisor to student 1.
 *
 * @param assignmentEnd - When the assignment ends, or null for open-ended.
 * @returns The service and the logger.
 */
function setup(assignmentEnd: string | null = null) {
  const store = {
    cases: [assigned, inReview, unrouted],
    assignments: [
      buildAdvisorAssignment({
        advisorUserId: advisor.userId,
        studentId: assignedStudent,
        effectiveTo: assignmentEnd,
      }),
    ],
  };
  const logger = createRecordingLogger();
  const service = createCaseQueueService({
    cases: createInMemoryCaseRepository(store),
    now: () => NOW,
  });
  return { service, logger };
}

describe('CaseQueueService.listQueue for an advisor', () => {
  it('lists the assigned student’s cases oldest first, routed, with ownership as a flag', async () => {
    const { service, logger } = setup();

    const queue = await service.listQueue(advisor, {}, { logger });

    expect(queue.cases.map((row) => [row.caseId, row.routed, row.ownerIsYou])).toEqual([
      [inReview.id, true, true],
      [assigned.id, true, false],
    ]);
  });

  it('filters by status', async () => {
    const { service, logger } = setup();

    const queue = await service.listQueue(advisor, { status: CaseStatus.Open }, { logger });

    expect(queue.cases.map((row) => row.caseId)).toEqual([assigned.id]);
  });

  it('lists nothing once the assignment has ended at the injected clock', async () => {
    const { service, logger } = setup('2026-09-01T12:00:00.000Z');

    expect((await service.listQueue(advisor, {}, { logger })).cases).toEqual([]);
  });

  it('refuses the unrouted view with NotFoundError', async () => {
    const { service, logger } = setup();

    await expect(service.listQueue(advisor, { unrouted: true }, { logger })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('refuses a student with NotFoundError', async () => {
    const { service, logger } = setup();

    await expect(service.listQueue(student, {}, { logger })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('logs the actor, filters and count, never a note', async () => {
    const { service, logger } = setup();

    await service.listQueue(advisor, {}, { logger });

    expect(logger.entries[0]?.details).toMatchObject({ actorUserId: advisor.userId, count: 2 });
    expect(JSON.stringify(logger.entries)).not.toContain(assigned.studentNote);
  });
});

describe('CaseQueueService.listQueue for an admin', () => {
  it('shows open unrouted cases, marked not routed, oldest first among all rows', async () => {
    const { service, logger } = setup();

    const queue = await service.listQueue(admin, { unrouted: true }, { logger });

    expect(queue.cases.map((row) => [row.caseId, row.routed])).toEqual([[unrouted.id, false]]);
  });

  it('mixes the admin’s routed cases and the unrouted ones by age by default', async () => {
    const { service, logger } = setup();
    const both = buildActor({ roles: [Role.Admin, Role.Advisor] }, 2);

    const queue = await service.listQueue(both, {}, { logger });

    expect(queue.cases.map((row) => row.caseId)).toEqual([inReview.id, unrouted.id, assigned.id]);
  });

  it('leaves out the unrouted cases with unrouted=false or another status', async () => {
    const { service, logger } = setup();
    const both = buildActor({ roles: [Role.Admin, Role.Advisor] }, 2);

    const routedOnly = await service.listQueue(both, { unrouted: false }, { logger });
    const reviewing = await service.listQueue(both, { status: CaseStatus.InReview }, { logger });

    expect(routedOnly.cases.map((row) => row.routed)).toEqual([true, true]);
    expect(reviewing.cases.map((row) => row.caseId)).toEqual([inReview.id]);
  });

  it('keeps the unrouted view when filtering to OPEN, and empties it for IN_REVIEW', async () => {
    const { service, logger } = setup();

    const open = await service.listQueue(
      admin,
      { unrouted: true, status: CaseStatus.Open },
      { logger },
    );
    const reviewing = await service.listQueue(
      admin,
      { unrouted: true, status: CaseStatus.InReview },
      { logger },
    );

    expect(open.cases).toHaveLength(1);
    expect(reviewing.cases).toEqual([]);
  });
});
