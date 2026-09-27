/**
 * @file Tests for student access decisions: every role allowed and denied, tenant isolation,
 * revocation between calls (AC15), and log content (FR-14).
 * @requirement FR-02
 * @requirement FR-14
 */
import { describe, expect, it } from 'vitest';

import { Role } from '@caa/domain';
import { buildActor, buildAdvisorAssignment, buildStudent, SYNTHETIC_TENANTS } from '@caa/test-kit';

import {
  createInMemoryRepositories,
  createRecordingLogger,
  type InMemoryStore,
} from '../../testing/in-memory-repositories';
import { createAccessService } from './access.service';

const NOW = '2026-09-01T12:00:00.000Z';

const studentActor = buildActor({ roles: [Role.Student] }, 1);
const advisorActor = buildActor({ roles: [Role.Advisor] }, 2);
const adminActor = buildActor({ roles: [Role.Admin] }, 4);
const ownStudent = buildStudent({ userId: studentActor.userId }, 1);
const otherStudent = buildStudent({}, 2);
const tenantBStudent = buildStudent({ tenantId: SYNTHETIC_TENANTS.b.id }, 3);
const assignment = buildAdvisorAssignment({
  advisorUserId: advisorActor.userId,
  studentId: ownStudent.id,
});

/**
 * Creates an access service over fresh in-memory data.
 *
 * @param overrides - Store fields to replace.
 * @returns The service, its mutable store, a settable clock, and the recording logger.
 */
function setup(overrides: Partial<InMemoryStore> = {}) {
  const store: InMemoryStore = {
    identities: [],
    students: [ownStudent, otherStudent, tenantBStudent],
    assignments: [assignment],
    ...overrides,
  };
  const clock = { now: new Date(NOW) };
  const logger = createRecordingLogger();
  const service = createAccessService({
    ...createInMemoryRepositories(store),
    now: () => clock.now,
    logger,
  });
  return { service, store, clock, logger };
}

describe('AccessService.canViewStudent', () => {
  it('allows a student to see their own record', async () => {
    expect(await setup().service.canViewStudent(studentActor, ownStudent.id)).toBe(true);
  });

  it("denies a student another student's record", async () => {
    expect(await setup().service.canViewStudent(studentActor, otherStudent.id)).toBe(false);
  });

  it('denies a non-student role even when its user is linked to the student', async () => {
    const linkedAdvisor = buildActor({ roles: [Role.Advisor] }, 1);

    expect(await setup().service.canViewStudent(linkedAdvisor, ownStudent.id)).toBe(false);
  });

  it('allows an advisor with an active assignment', async () => {
    expect(await setup().service.canViewStudent(advisorActor, ownStudent.id)).toBe(true);
  });

  it('denies an advisor with no assignment to the student', async () => {
    expect(await setup().service.canViewStudent(advisorActor, otherStudent.id)).toBe(false);
  });

  it('denies an advisor before the assignment starts', async () => {
    const { service, clock } = setup();
    clock.now = new Date('2026-08-01T00:00:00.000Z');

    expect(await service.canViewStudent(advisorActor, ownStudent.id)).toBe(false);
  });

  it('denies the second call after the assignment is revoked between calls (AC15)', async () => {
    const { service, store } = setup();

    const wasAllowedBefore = await service.canViewStudent(advisorActor, ownStudent.id);
    store.assignments = [{ ...assignment, effectiveTo: '2026-09-01T11:00:00.000Z' }];
    const isAllowedAfter = await service.canViewStudent(advisorActor, ownStudent.id);

    expect([wasAllowedBefore, isAllowedAfter]).toEqual([true, false]);
  });

  it('denies once the clock passes the end of the assignment (AC15)', async () => {
    const ending = { ...assignment, effectiveTo: '2026-09-01T13:00:00.000Z' };
    const { service, clock } = setup({ assignments: [ending] });

    const wasAllowedBefore = await service.canViewStudent(advisorActor, ownStudent.id);
    clock.now = new Date('2026-09-01T13:00:00.000Z');
    const isAllowedAfter = await service.canViewStudent(advisorActor, ownStudent.id);

    expect([wasAllowedBefore, isAllowedAfter]).toEqual([true, false]);
  });

  it('allows an admin to see any student in the same tenant', async () => {
    expect(await setup().service.canViewStudent(adminActor, otherStudent.id)).toBe(true);
  });

  it('denies an admin a student in another tenant', async () => {
    expect(await setup().service.canViewStudent(adminActor, tenantBStudent.id)).toBe(false);
  });

  it('denies an advisor whose assignment points at a student in another tenant', async () => {
    const crossTenant = buildAdvisorAssignment({
      tenantId: SYNTHETIC_TENANTS.b.id,
      advisorUserId: advisorActor.userId,
      studentId: tenantBStudent.id,
    });
    const { service } = setup({ assignments: [crossTenant] });

    expect(await service.canViewStudent(advisorActor, tenantBStudent.id)).toBe(false);
  });

  it('denies a student that does not exist', async () => {
    const missing = buildStudent({}, 99);

    expect(await setup().service.canViewStudent(adminActor, missing.id)).toBe(false);
  });

  it('denies a student from another tenant even if a repository returns it', async () => {
    const leaky = createAccessService({
      advisorAssignments: { findActive: () => Promise.resolve(null) },
      students: {
        findById: () => Promise.resolve(tenantBStudent),
        findBySourceStudentId: () => Promise.resolve(null),
      },
      now: () => new Date(NOW),
      logger: createRecordingLogger(),
    });

    expect(await leaky.canViewStudent(adminActor, tenantBStudent.id)).toBe(false);
  });

  it('logs every decision with opaque IDs only', async () => {
    const { service, logger } = setup();

    await service.canViewStudent(advisorActor, ownStudent.id);
    await service.canViewStudent(studentActor, otherStudent.id);

    expect(logger.entries).toEqual([
      {
        message: 'student access decision',
        details: {
          actorUserId: advisorActor.userId,
          tenantId: SYNTHETIC_TENANTS.a.id,
          studentId: ownStudent.id,
          isAllowed: true,
          reason: 'ACTIVE_ASSIGNMENT',
        },
      },
      {
        message: 'student access decision',
        details: {
          actorUserId: studentActor.userId,
          tenantId: SYNTHETIC_TENANTS.a.id,
          studentId: otherStudent.id,
          isAllowed: false,
          reason: 'NO_GRANT',
        },
      },
    ]);
    expect(JSON.stringify(logger.entries)).not.toContain(ownStudent.sourceStudentId);
  });
});
