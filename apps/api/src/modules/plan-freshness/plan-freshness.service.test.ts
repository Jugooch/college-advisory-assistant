/**
 * @file Service tests for reading current sources: an unreadable source is UNKNOWN, logged by an
 * opaque label only, and never fails the read (AC14, NFR-05).
 * @requirement FR-11
 * @requirement NFR-05
 */
import { describe, expect, it } from 'vitest';

import { PlanFreshness, PlanStaleReason, Role } from '@caa/domain';
import { StudentIdSchema } from '@caa/domain';
import { buildActor, buildPlanRevision, SYNTHETIC_TENANTS, syntheticId } from '@caa/test-kit';

import { createRecordingLogger } from '../../testing/in-memory-repositories';
import {
  createPlanFreshnessService,
  type PlanFreshnessServiceDependencies,
} from './plan-freshness.service';

const AT = '2026-09-01T00:00:00.000Z';
const NOW = new Date('2026-09-01T06:00:00.000Z');
const actor = buildActor({ roles: [Role.Student], tenantId: SYNTHETIC_TENANTS.a.id }, 1);
const revision = buildPlanRevision({
  studentRecordEffectiveAt: AT,
  auditRecordEffectiveAt: AT,
  campusTransitionVersion: null,
});
const studentId = StudentIdSchema.parse(syntheticId('student', 1));

/** Dependencies where every source is current. */
const current: PlanFreshnessServiceDependencies = {
  studentSnapshots: {
    findLatest: () =>
      Promise.resolve({
        status: 'AMBIGUOUS',
      }),
  },
  auditSnapshots: { findLatest: () => Promise.resolve(null) },
  sectionSnapshots: { findLatestPublished: () => Promise.resolve(null) },
  campusTransitions: { findPolicy: () => Promise.resolve(null) },
  now: () => NOW,
  maxSourceAgeMs: 86_400_000,
  rulesetVersion: null,
};

describe('PlanFreshnessService.assess', () => {
  it('is UNKNOWN when every source is missing, tied, or unconfigured, and does not throw', async () => {
    const logger = createRecordingLogger();
    const service = createPlanFreshnessService(current);

    const result = await service.assess(actor, { studentId, revision }, { logger });

    expect(result).toEqual({
      state: PlanFreshness.Unknown,
      reasons: [PlanStaleReason.SourceUnavailable],
      checkedAt: NOW.toISOString(),
    });
  });

  it('logs a failing read by its opaque label, never the error text', async () => {
    const logger = createRecordingLogger();
    const service = createPlanFreshnessService({
      ...current,
      campusTransitions: { findPolicy: () => Promise.reject(new Error('secret value 12345')) },
    });

    const result = await service.assess(actor, { studentId, revision }, { logger });

    expect(result.state).toBe(PlanFreshness.Unknown);
    expect(logger.entries).toEqual([
      {
        level: 'warn',
        message: 'plan freshness source unreadable',
        details: { source: 'campusTransition' },
      },
    ]);
  });

  it('reads every source for the session tenant, the plan student, and the plan term', async () => {
    const calls: unknown[] = [];
    const service = createPlanFreshnessService({
      ...current,
      studentSnapshots: {
        findLatest: (...args) => {
          calls.push(args);
          return Promise.resolve(null);
        },
      },
      sectionSnapshots: {
        findLatestPublished: (...args) => {
          calls.push(args);
          return Promise.resolve(null);
        },
      },
    });

    await service.assess(actor, { studentId, revision }, { logger: createRecordingLogger() });

    expect(calls).toEqual([
      [actor.tenantId, studentId],
      [actor.tenantId, revision.termId],
    ]);
  });
});
