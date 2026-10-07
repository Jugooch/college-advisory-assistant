/**
 * @file Synthetic plan-draft payloads for contract tests. Test support only: not exported from
 *   the package. Every value is synthetic.
 * @module @caa/api-contract/testing/plan-draft-fixtures
 */
import {
  buildResponse,
  type Payload,
  PHYS_301,
  PINNED_INPUTS,
  sectionId,
  TERM_ID,
} from './schedule-option-fixtures';

/** A plan ID. */
export const PLAN_ID = '7b000000-0000-4000-8000-000000000001';

/** A revision ID. */
export const REVISION_ID = '7a000000-0000-4000-8000-000000000001';

/** A current freshness result. */
export const CURRENT_FRESHNESS: Payload = {
  state: 'CURRENT',
  reasons: [],
  checkedAt: '2026-10-07T09:05:00.000-05:00',
};

/**
 * Builds a saved revision view whose stored fields match {@link buildResponse}'s result.
 *
 * @param fields - Revision fields to set.
 * @returns A revision view payload.
 */
export function buildRevisionView(fields: Payload = {}): Payload {
  return {
    id: REVISION_ID,
    planId: PLAN_ID,
    revision: 1,
    cause: 'SAVED',
    createdAt: '2026-10-07T09:00:00.000-05:00',
    termId: TERM_ID,
    courseIds: [PHYS_301],
    creditSelections: [],
    constraints: [],
    studentSnapshotId: PINNED_INPUTS.studentSnapshotId,
    studentRecordEffectiveAt: PINNED_INPUTS.studentRecordEffectiveAt,
    auditRecordEffectiveAt: PINNED_INPUTS.auditRecordEffectiveAt,
    auditSnapshotId: '4b000000-0000-4000-8000-000000000001',
    auditSource: PINNED_INPUTS.auditSource,
    auditVersion: PINNED_INPUTS.auditVersion,
    rulesetVersion: PINNED_INPUTS.rulesetVersion,
    sectionSnapshotId: PINNED_INPUTS.sectionSnapshotId,
    campusTransitionVersion: PINNED_INPUTS.campusTransitionVersion,
    solverWorkCap: PINNED_INPUTS.solverWorkCap,
    constraintHash: PINNED_INPUTS.constraintHash,
    outcome: 'OPTIONS_FOUND',
    selectedSectionIds: [sectionId(1)],
    result: buildResponse(),
    resultUnavailable: false,
    freshness: CURRENT_FRESHNESS,
    ...fields,
  };
}

/**
 * Builds a plan view whose latest revision is revision 1.
 *
 * @param fields - Plan fields to set.
 * @returns A plan view payload.
 */
export function buildPlanView(fields: Payload = {}): Payload {
  return {
    id: PLAN_ID,
    termId: TERM_ID,
    createdAt: '2026-10-07T09:00:00.000-05:00',
    latest: buildRevisionView(),
    revisions: [{ revision: 1, cause: 'SAVED', createdAt: '2026-10-07T09:00:00.000-05:00' }],
    ...fields,
  };
}
