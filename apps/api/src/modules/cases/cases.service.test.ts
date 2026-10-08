/**
 * @file Service tests for advisor cases with injected fakes: student-only creation, the actor
 * kind behind `allowedActions`, atomic create timed by the clock, logs without the note, and no
 * outbound dependency.
 * @requirement FR-01
 * @requirement FR-12
 * @requirement FR-14
 * @requirement FR-15
 * @requirement FR-17
 */
import { describe, expect, it } from 'vitest';

import type { CreateCaseRequest } from '@caa/api-contract';
import { CaseAction, CaseReason, CaseStatus, Role, StudentIdSchema } from '@caa/domain';
import {
  buildActor,
  buildPlan,
  buildPlanRevision,
  buildPlanRevisionView,
  buildStudent,
  SYNTHETIC_TENANTS,
  syntheticId,
} from '@caa/test-kit';

import { NotFoundError, OpenCaseExistsError } from '../../shared/domain-errors';
import { createInMemoryCaseRepository } from '../../testing/in-memory-case-repositories';
import { createRecordingLogger } from '../../testing/in-memory-repositories';
import type { CaseContextService } from '../case-context/case-context.service';
import { createCaseViewerService } from '../case-viewer/case-viewer.service';
import { createCasesService } from './cases.service';

const NOW = new Date('2026-09-01T12:00:00.000Z');
const studentActor = buildActor({ roles: [Role.Student] }, 1);
const advisorActor = buildActor({ roles: [Role.Advisor] }, 2);
const student = buildStudent({ userId: studentActor.userId }, 1);
const studentId = StudentIdSchema.parse(student.id);
const revisionId = syntheticId('planRevision', 1);
const NOTE = 'A synthetic note that must never be logged.';
const body: CreateCaseRequest = {
  reason: CaseReason.PlanReview,
  planRevisionId: revisionId as CreateCaseRequest['planRevisionId'],
  discrepancySubject: null,
  studentNote: NOTE,
};

/**
 * Builds the service over fakes.
 *
 * @param options - Whether the revision exists, and whether the actor may open and view.
 * @returns The service, the case store, and the logger.
 */
function setup(options: { hasRevision?: boolean; canOpen?: boolean; canView?: boolean } = {}) {
  const store = {
    students: [student],
    plans: [buildPlan()],
    planRevisions: [{ revision: buildPlanRevision(), result: {} }],
    cases: [],
    caseEvents: [],
  };
  const logger = createRecordingLogger();
  const caseContext: CaseContextService = {
    hasRevision: () => Promise.resolve(options.hasRevision ?? true),
    contextOf: () =>
      Promise.resolve(buildPlanRevisionView({ id: body.planRevisionId ?? revisionId })),
  };
  const dependencies = {
    access: {
      canOpenCase: () => Promise.resolve(options.canOpen ?? true),
      canViewStudent: () => Promise.resolve(options.canView ?? true),
    },
    cases: createInMemoryCaseRepository(store),
    caseViewer: createCaseViewerService({
      students: { findById: () => Promise.resolve(student) },
      caseContext,
    }),
    caseContext,
    now: () => NOW,
  };
  return { service: createCasesService(dependencies), store, logger, dependencies };
}

describe('CasesService.createCase', () => {
  it('creates an OPEN case with its CREATE event at the injected time', async () => {
    const { service, store, logger } = setup();

    const view = await service.createCase(studentActor, { studentId, body }, { logger });

    expect(view).toMatchObject({ status: CaseStatus.Open, createdAt: NOW.toISOString() });
    expect(view.allowedActions).toEqual([CaseAction.Withdraw]);
    expect(store.cases).toHaveLength(1);
    expect(store.caseEvents).toHaveLength(1);
  });

  it('refuses anyone who may not open a case with NotFoundError, writing nothing', async () => {
    const { service, store, logger } = setup({ canOpen: false });

    await expect(
      service.createCase(advisorActor, { studentId, body }, { logger }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(store.cases).toHaveLength(0);
  });

  it('refuses a revision that is not the student’s with NotFoundError, writing nothing', async () => {
    const { service, store, logger } = setup({ hasRevision: false });

    await expect(
      service.createCase(studentActor, { studentId, body }, { logger }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(store.cases).toHaveLength(0);
  });

  it('refuses a second open case on the plan with OpenCaseExistsError', async () => {
    const { service, logger } = setup();
    await service.createCase(studentActor, { studentId, body }, { logger });

    await expect(
      service.createCase(studentActor, { studentId, body }, { logger }),
    ).rejects.toBeInstanceOf(OpenCaseExistsError);
  });

  it('logs IDs, reason and status, never the note', async () => {
    const { service, logger } = setup();

    await service.createCase(studentActor, { studentId, body }, { logger });

    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]?.details).toMatchObject({
      reason: CaseReason.PlanReview,
      status: CaseStatus.Open,
      tenantId: SYNTHETIC_TENANTS.a.id,
    });
    expect(JSON.stringify(logger.entries)).not.toContain(NOTE);
  });

  it('has no dependency that could send anything outside the app (FR-15)', () => {
    const { dependencies } = setup();

    expect(Object.keys(dependencies).sort()).toEqual([
      'access',
      'caseContext',
      'caseViewer',
      'cases',
      'now',
    ]);
  });
});

describe('CasesService reads', () => {
  it('lists the student’s cases only when the actor may view the student', async () => {
    const { service, logger } = setup({ canView: false });

    await expect(
      service.listStudentCases(advisorActor, studentId, { logger }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('answers a missing case with NotFoundError', async () => {
    const { service, logger } = setup();

    await expect(
      service.getCase(studentActor, syntheticId('advisingCase', 9) as never, { logger }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('answers a case the actor may not view with NotFoundError', async () => {
    const created = setup();
    const view = await created.service.createCase(
      studentActor,
      { studentId, body },
      { logger: created.logger },
    );
    const denied = setup({ canView: false });
    denied.store.cases = created.store.cases;
    denied.store.caseEvents = created.store.caseEvents;

    await expect(
      denied.service.getCase(advisorActor, view.id, { logger: denied.logger }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
