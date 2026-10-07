/**
 * @file Reads students on behalf of an authorized actor.
 * @module @caa/api/modules/students/students.service
 * @requirement FR-02
 */
import type { StudentRepository } from '@caa/db';
import type { Actor, Student, StudentId } from '@caa/domain';

import { NotFoundError } from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import type { AccessService } from '../access/access.service';

/** Dependencies of the students service. */
export interface StudentsServiceDependencies {
  readonly access: Pick<AccessService, 'canViewStudent'>;
  readonly students: StudentRepository;
}

/** Student reads, each gated by the access service. */
export interface StudentsService {
  /**
   * Reads one student the actor may see.
   *
   * @param actor - Authenticated actor from the session.
   * @param studentId - Internal student ID.
   * @param context - Request-scoped values, passed on to the access decision.
   * @returns The student.
   * @throws {NotFoundError} When the student doesn't exist or the actor may not see it.
   */
  getStudent(actor: Actor, studentId: StudentId, context: RequestContext): Promise<Student>;
}

/**
 * Creates the students service.
 *
 * @param dependencies - Access service and student repository.
 * @returns A {@link StudentsService}.
 */
export function createStudentsService(dependencies: StudentsServiceDependencies): StudentsService {
  return {
    async getStudent(actor, studentId, context) {
      // SECURITY: denied and missing are the same NOT_FOUND, so existence isn't revealed.
      if (!(await dependencies.access.canViewStudent(actor, studentId, context))) {
        throw new NotFoundError();
      }
      const student = await dependencies.students.findById(actor.tenantId, studentId);
      if (student === null) {
        throw new NotFoundError();
      }
      return student;
    },
  };
}
