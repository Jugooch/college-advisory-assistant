/**
 * @file Creates advisor cases for a student and shows them to the student and to the advisors
 * who may see the student. A case is internal to this app: nothing is sent or written to any
 * other system (FR-15).
 * @module @caa/api/modules/cases/cases.service
 * @requirement FR-01
 * @requirement FR-02
 * @requirement FR-12
 * @requirement FR-14
 * @requirement FR-15
 * @requirement FR-17
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { CaseListResponse, CaseView, CreateCaseRequest } from '@caa/api-contract';
import type { AdvisingCaseRepository } from '@caa/db';
import type { Actor, AdvisingCase, CaseId, StudentId } from '@caa/domain';

import { NotFoundError, OpenCaseExistsError } from '../../shared/domain-errors';
import type { RequestContext } from '../../shared/request-context';
import type { AccessService } from '../access/access.service';
import type { CaseContextService } from '../case-context/case-context.service';
import type { CaseViewer } from '../case-viewer/case-viewer.service';
import { toCaseSummary } from './cases.mapper';

/** Dependencies of the cases service. */
export interface CasesServiceDependencies {
  readonly access: Pick<AccessService, 'canOpenCase' | 'canViewStudent'>;
  readonly cases: AdvisingCaseRepository;
  readonly viewCase: CaseViewer;
  readonly caseContext: CaseContextService;
  /** Returns the current time; the only clock a case time comes from. */
  readonly now: () => Date;
}

/** What a create is for: the path student and the validated body. */
export interface CreateCaseCommand {
  readonly studentId: StudentId;
  readonly body: CreateCaseRequest;
}

/** Case creation and the reads of a student's cases. */
export interface CasesService {
  /**
   * Opens a case for the student's own record. The case and its CREATE event are written
   * together, timed by the injected clock.
   *
   * @param actor - Authenticated actor from the session.
   * @param command - The path student and the validated body.
   * @param context - Request-scoped values.
   * @returns The new case as the student sees it.
   * @throws {NotFoundError} When the actor is not this student, or the revision is not the
   *   student's in the actor's tenant.
   * @throws {OpenCaseExistsError} When the plan already has an open or in-review case.
   * @throws {Error} When the stored case or its revision breaks a contract.
   */
  createCase(actor: Actor, command: CreateCaseCommand, context: RequestContext): Promise<CaseView>;

  /**
   * Lists the student's cases, newest first, without notes.
   *
   * @param actor - Authenticated actor from the session.
   * @param studentId - Internal student ID from the path.
   * @param context - Request-scoped values.
   * @returns The student's case history.
   * @throws {NotFoundError} When the actor may not see the student.
   */
  listStudentCases(
    actor: Actor,
    studentId: StudentId,
    context: RequestContext,
  ): Promise<CaseListResponse>;

  /**
   * Reads one case with its events, its frozen plan revision, and the actions allowed now.
   *
   * @param actor - Authenticated actor from the session.
   * @param caseId - Case ID from the path.
   * @param context - Request-scoped values.
   * @returns The case view.
   * @throws {NotFoundError} When the case is missing, or the actor may not see its student.
   * @throws {Error} When the stored case, its events, or its revision break a contract.
   */
  getCase(actor: Actor, caseId: CaseId, context: RequestContext): Promise<CaseView>;
}

/**
 * Logs a created case.
 *
 * @param actor - The student who opened it.
 * @param created - The new case.
 * @param context - Request-scoped values.
 */
function logCreated(actor: Actor, created: AdvisingCase, context: RequestContext): void {
  // SECURITY: IDs, reason, and status only. Never the student's note.
  context.logger.info(
    {
      actorUserId: actor.userId,
      tenantId: actor.tenantId,
      studentId: created.studentId,
      caseId: created.id,
      reason: created.reason,
      status: created.status,
    },
    'advisor case created',
  );
}

/**
 * Creates the cases service.
 *
 * @param dependencies - Access rule, case and student repositories, context reader, and clock.
 * @returns A {@link CasesService}.
 */
export function createCasesService(dependencies: CasesServiceDependencies): CasesService {
  const { access, cases, caseContext } = dependencies;
  const viewOf = dependencies.viewCase;

  return {
    async createCase(actor, command, context) {
      // SECURITY: only the student, for their own record. Anyone else gets the same NOT_FOUND
      // as a missing student, so existence isn't revealed.
      if (!(await access.canOpenCase(actor, command.studentId, context))) {
        throw new NotFoundError();
      }
      const { body, studentId } = command;
      // SECURITY: the revision must be this student's, in the actor's tenant (the repository
      // re-checks it); a stale revision is allowed, and its context shows STALE.
      if (
        body.planRevisionId !== null &&
        !(await caseContext.hasRevision(actor, { studentId, planRevisionId: body.planRevisionId }))
      ) {
        throw new NotFoundError();
      }
      const result = await cases.create(actor.tenantId, {
        studentId,
        reason: body.reason,
        planRevisionId: body.planRevisionId,
        discrepancySubject: body.discrepancySubject,
        studentNote: body.studentNote,
        actorUserId: actor.userId,
        createdAt: dependencies.now().toISOString(),
      });
      if (result.status === 'OPEN_CASE_EXISTS') {
        throw new OpenCaseExistsError();
      }
      if (result.status !== 'CREATED') {
        throw new NotFoundError();
      }
      logCreated(actor, result.case, context);
      return viewOf(actor, { advisingCase: result.case, events: [result.event] }, context);
    },

    async listStudentCases(actor, studentId, context) {
      if (!(await access.canViewStudent(actor, studentId, context))) {
        throw new NotFoundError();
      }
      const found = await cases.listForStudent(actor.tenantId, studentId);
      return { cases: found.map(toCaseSummary) };
    },

    async getCase(actor, caseId, context) {
      const advisingCase = await cases.findById(actor.tenantId, caseId);
      // SECURITY: a missing case and one the actor may not see are the same NOT_FOUND. The
      // access rule is checked on every read, so a revoked assignment applies immediately.
      if (
        advisingCase === null ||
        !(await access.canViewStudent(actor, advisingCase.studentId, context))
      ) {
        throw new NotFoundError();
      }
      const events = await cases.listEvents(actor.tenantId, caseId);
      return viewOf(actor, { advisingCase, events }, context);
    },
  };
}
