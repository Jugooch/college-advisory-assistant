/**
 * @file Builds synthetic advising cases for tests.
 * @module @caa/test-kit/builders/advising-case
 */
import {
  type AdvisingCase,
  type AdvisingCaseInput,
  CaseReason,
  CaseStatus,
  createAdvisingCase,
} from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';
import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';

/**
 * Builds a valid `OPEN` plan-review case with no owner, for student 1 in tenant A.
 *
 * Defaults: plan revision seed 1 and `lastSequence` 1 (the CREATE event).
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes cases; drives the default `id`.
 * @returns A validated advising case.
 */
export function buildAdvisingCase(
  overrides: Partial<AdvisingCaseInput> = {},
  seed = 1,
): AdvisingCase {
  return createAdvisingCase({
    id: syntheticId('advisingCase', seed),
    tenantId: SYNTHETIC_TENANTS.a.id,
    studentId: syntheticId('student', 1),
    reason: CaseReason.PlanReview,
    planRevisionId: syntheticId('planRevision', 1),
    discrepancySubject: null,
    studentNote: 'Please check this plan before I register.',
    status: CaseStatus.Open,
    ownerUserId: null,
    createdAt: '2026-09-22T10:00:00.000-05:00',
    lastSequence: 1,
    ...overrides,
  });
}

/**
 * Builds a valid `IN_REVIEW` case owned by advisor user 2, after CREATE and CLAIM events.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes cases; drives the default `id`.
 * @returns A validated advising case.
 */
export function buildInReviewAdvisingCase(
  overrides: Partial<AdvisingCaseInput> = {},
  seed = 1,
): AdvisingCase {
  return buildAdvisingCase(
    {
      status: CaseStatus.InReview,
      ownerUserId: syntheticId('user', 2),
      lastSequence: 2,
      ...overrides,
    },
    seed,
  );
}

/**
 * Builds a valid `RESOLVED` case owned by advisor user 2, after CREATE, CLAIM and RESOLVE events.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes cases; drives the default `id`.
 * @returns A validated advising case.
 */
export function buildResolvedAdvisingCase(
  overrides: Partial<AdvisingCaseInput> = {},
  seed = 1,
): AdvisingCase {
  return buildAdvisingCase(
    {
      status: CaseStatus.Resolved,
      ownerUserId: syntheticId('user', 2),
      lastSequence: 3,
      ...overrides,
    },
    seed,
  );
}
