/**
 * @file Decides whether an actor may see a student, and logs every decision with opaque IDs.
 * @module @caa/api/modules/access/access.service
 * @requirement FR-02
 * @requirement FR-14
 * @see docs/standards/09-errors-logging-and-security.md
 * @see docs/planning/12-security-privacy-and-procurement.md
 */
import type { AdvisorAssignmentRepository, StudentRepository } from '@caa/db';
import { type Actor, Role, type Student, type StudentId } from '@caa/domain';

import type { RequestContext } from '../../shared/request-context';

/** Why access was granted or denied. Logged; never shown to the client. */
export type AccessReason =
  'OWN_RECORD' | 'ACTIVE_ASSIGNMENT' | 'ADMIN_SAME_TENANT' | 'STUDENT_NOT_FOUND' | 'NO_GRANT';

/** Dependencies of the access service. */
export interface AccessServiceDependencies {
  readonly students: StudentRepository;
  readonly advisorAssignments: AdvisorAssignmentRepository;
  /** Returns the current time. Injected so assignment windows are evaluated deterministically. */
  readonly now: () => Date;
}

/** Authorization decisions for student-scoped objects. */
export interface AccessService {
  /**
   * Decides whether the actor may see a student. Deny by default.
   *
   * @param actor - Authenticated actor from the session.
   * @param studentId - Internal student ID.
   * @param context - Request-scoped values; its logger gives the decision line the request ID.
   * @returns True only for the student themself, an advisor with an active assignment, or an admin,
   *   all within the actor's tenant.
   */
  canViewStudent(actor: Actor, studentId: StudentId, context: RequestContext): Promise<boolean>;

  /**
   * Decides whether the actor may save or revalidate a plan for the student. Only the student's
   * own record qualifies: an assigned advisor or an admin may read a plan, not author it
   * (ADR-0013 §5).
   *
   * @param actor - Authenticated actor from the session.
   * @param studentId - Internal student ID from the path.
   * @param context - Request-scoped values; the decision is logged with opaque IDs only.
   * @returns True only when the student is in the actor's tenant and linked to the actor's user.
   */
  canSavePlan(actor: Actor, studentId: StudentId, context: RequestContext): Promise<boolean>;

  /**
   * Decides whether the actor may open an advisor case for the student. Only the student's own
   * record qualifies: an assigned advisor or an admin may read a case, not open one for the
   * student (ADR-0013 §6).
   *
   * @param actor - Authenticated actor from the session.
   * @param studentId - Internal student ID from the path.
   * @param context - Request-scoped values; the decision is logged with opaque IDs only.
   * @returns True only when the student is in the actor's tenant and linked to the actor's user.
   */
  canOpenCase(actor: Actor, studentId: StudentId, context: RequestContext): Promise<boolean>;
}

/**
 * Decides whether the student record is the actor's own: a student in the actor's tenant whose
 * linked user is the actor.
 *
 * @param students - Student repository.
 * @param actor - Authenticated actor from the session.
 * @param studentId - Internal student ID from the path.
 * @returns True only for the student's own record.
 */
async function isOwnRecord(
  students: StudentRepository,
  actor: Actor,
  studentId: StudentId,
): Promise<boolean> {
  // SECURITY: the tenant comes from the session actor, never from the request.
  const student = await students.findById(actor.tenantId, studentId);
  return (
    student !== null &&
    student.tenantId === actor.tenantId &&
    actor.roles.includes(Role.Student) &&
    student.userId === actor.userId
  );
}

/**
 * Creates the access service.
 *
 * @param dependencies - Repositories and clock.
 * @returns An {@link AccessService}.
 */
export function createAccessService(dependencies: AccessServiceDependencies): AccessService {
  const decide = async (actor: Actor, student: Student): Promise<AccessReason> => {
    // SECURITY: defense in depth; the repository already filters by the session's tenant.
    if (student.tenantId !== actor.tenantId) {
      return 'NO_GRANT';
    }
    if (actor.roles.includes(Role.Admin)) {
      return 'ADMIN_SAME_TENANT';
    }
    if (actor.roles.includes(Role.Student) && student.userId === actor.userId) {
      return 'OWN_RECORD';
    }
    if (actor.roles.includes(Role.Advisor)) {
      // SECURITY: the assignment is checked on every call, so a revocation applies immediately.
      const assignment = await dependencies.advisorAssignments.findActive(actor.tenantId, {
        advisorUserId: actor.userId,
        studentId: student.id,
        at: dependencies.now().toISOString(),
      });
      if (assignment !== null) {
        return 'ACTIVE_ASSIGNMENT';
      }
    }
    return 'NO_GRANT';
  };

  return {
    async canViewStudent(actor, studentId, context) {
      // SECURITY: the tenant comes from the session actor, never from the request.
      const student = await dependencies.students.findById(actor.tenantId, studentId);
      const reason = student === null ? 'STUDENT_NOT_FOUND' : await decide(actor, student);
      const isAllowed = reason !== 'STUDENT_NOT_FOUND' && reason !== 'NO_GRANT';
      // SECURITY: opaque IDs only (FR-14); no names and no source student IDs.
      context.logger.info(
        { actorUserId: actor.userId, tenantId: actor.tenantId, studentId, isAllowed, reason },
        'student access decision',
      );
      return isAllowed;
    },
    async canSavePlan(actor, studentId, context) {
      // SECURITY: authoring is limited to the student's own record, so an advisor or admin who
      // can read the plan still can't save one for the student (ADR-0013 §5).
      const isAllowed = await isOwnRecord(dependencies.students, actor, studentId);
      context.logger.info(
        { actorUserId: actor.userId, tenantId: actor.tenantId, studentId, isAllowed },
        'plan save access decision',
      );
      return isAllowed;
    },
    async canOpenCase(actor, studentId, context) {
      // SECURITY: only the student opens a case, and only for their own record (ADR-0013 §6).
      const isAllowed = await isOwnRecord(dependencies.students, actor, studentId);
      context.logger.info(
        { actorUserId: actor.userId, tenantId: actor.tenantId, studentId, isAllowed },
        'case open access decision',
      );
      return isAllowed;
    },
  };
}
