/**
 * @file Tests that the frozen revision is found by its own ID among the student's plans only,
 * in the actor's tenant, and shown as that revision, never a newer one.
 * @requirement FR-12
 * @requirement FR-15
 */
import { describe, expect, it } from 'vitest';

import { PlanRevisionIdSchema, Role, StudentIdSchema } from '@caa/domain';
import {
  buildActor,
  buildPlan,
  buildPlanRevision,
  buildPlanRevisionView,
  SYNTHETIC_TENANTS,
  syntheticId,
} from '@caa/test-kit';

import { NotFoundError } from '../../shared/domain-errors';
import { createInMemoryPlanRepository } from '../../testing/in-memory-plan-repositories';
import { createRecordingLogger } from '../../testing/in-memory-repositories';
import { createCaseContextService } from './case-context.service';

const actor = buildActor({ roles: [Role.Student], tenantId: SYNTHETIC_TENANTS.a.id }, 1);
const studentId = StudentIdSchema.parse(syntheticId('student', 1));
const first = buildPlanRevision({ revision: 1 }, 1);
const second = buildPlanRevision({ revision: 2 }, 2);

/**
 * Builds the service over a plan with two revisions, recording which revision was shown.
 *
 * @param plan - Overrides for the plan, for example another tenant.
 * @returns The service, the revisions shown, and the repository calls made.
 */
function setup(plan: Parameters<typeof buildPlan>[0] = {}) {
  const shown: number[] = [];
  const real = createInMemoryPlanRepository({
    plans: [buildPlan(plan)],
    planRevisions: [
      { revision: first, result: {} },
      { revision: second, result: {} },
    ],
  });
  const calls = { byId: 0, scans: 0 };
  const repository = {
    ...real,
    findRevisionById: (...args: Parameters<typeof real.findRevisionById>) => {
      calls.byId += 1;
      return real.findRevisionById(...args);
    },
    findRevision: (...args: Parameters<typeof real.findRevision>) => {
      calls.scans += 1;
      return real.findRevision(...args);
    },
    listForStudent: (...args: Parameters<typeof real.listForStudent>) => {
      calls.scans += 1;
      return real.listForStudent(...args);
    },
  };
  const service = createCaseContextService({
    plans: repository,
    views: {
      getRevision: (_actor, query) => {
        shown.push(query.revision);
        return Promise.resolve(buildPlanRevisionView({ revision: query.revision }));
      },
    },
  });
  return { service, shown, calls };
}

describe('CaseContextService', () => {
  it('shows the named revision, not the latest', async () => {
    const { service, shown } = setup();

    await service.contextOf(
      actor,
      { studentId, planRevisionId: first.id },
      { logger: createRecordingLogger() },
    );

    expect(shown).toEqual([1]);
  });

  it('knows the student has a revision of their own plan', async () => {
    const { service } = setup();

    expect(await service.hasRevision(actor, { studentId, planRevisionId: second.id })).toBe(true);
  });

  it.each([
    [
      'an unknown revision',
      { planRevisionId: PlanRevisionIdSchema.parse(syntheticId('planRevision', 99)), plan: {} },
    ],
    [
      'a plan of another tenant',
      { planRevisionId: first.id, plan: { tenantId: SYNTHETIC_TENANTS.b.id } },
    ],
    [
      'a plan of another student',
      { planRevisionId: first.id, plan: { studentId: syntheticId('student', 2) } },
    ],
  ])('does not find %s', async (_name, { planRevisionId, plan }) => {
    const { service, shown } = setup(plan);

    expect(await service.hasRevision(actor, { studentId, planRevisionId })).toBe(false);
    await expect(
      service.contextOf(actor, { studentId, planRevisionId }, { logger: createRecordingLogger() }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(shown).toEqual([]);
  });

  it('finds the revision by its ID without scanning the plans', async () => {
    const { service, calls } = setup();

    await service.hasRevision(actor, { studentId, planRevisionId: second.id });

    expect(calls).toEqual({ byId: 1, scans: 0 });
  });
});
