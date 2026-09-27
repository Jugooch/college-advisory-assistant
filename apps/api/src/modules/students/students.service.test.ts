/**
 * @file Tests for the students service.
 * @requirement FR-02
 */
import { describe, expect, it } from 'vitest';

import { buildActor, buildStudent } from '@caa/test-kit';

import { NotFoundError } from '../../shared/domain-errors';
import {
  createInMemoryRepositories,
  createRecordingLogger,
} from '../../testing/in-memory-repositories';
import { createStudentsService } from './students.service';

const actor = buildActor();
const student = buildStudent({ userId: actor.userId });
const logger = createRecordingLogger();

/**
 * Creates the service with an access decision fixed to the given value.
 *
 * @param isAllowed - What the fake access service returns.
 * @param students - Students the repository holds.
 * @returns The students service.
 */
function setup(isAllowed: boolean, students = [student]) {
  return createStudentsService({
    access: { canViewStudent: () => Promise.resolve(isAllowed) },
    students: createInMemoryRepositories({ identities: [], students, assignments: [] }).students,
  });
}

describe('StudentsService.getStudent', () => {
  it('returns the student when access is allowed', async () => {
    expect(await setup(true).getStudent(actor, student.id, logger)).toEqual(student);
  });

  it('throws NOT_FOUND when access is denied', async () => {
    await expect(setup(false).getStudent(actor, student.id, logger)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('throws NOT_FOUND when the student disappears after the access check', async () => {
    await expect(setup(true, []).getStudent(actor, student.id, logger)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
