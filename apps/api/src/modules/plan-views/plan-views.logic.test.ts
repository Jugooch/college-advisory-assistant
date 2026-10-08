/**
 * @file Tests which open case status a plan shows, from literal cases and revision IDs.
 * @requirement FR-11
 */
import { describe, expect, it } from 'vitest';

import { CaseReason, CaseStatus, DiscrepancySubject } from '@caa/domain';
import { buildAdvisingCase, syntheticId } from '@caa/test-kit';

import { openCaseStatusOf } from './plan-views.logic';

const REVISION = syntheticId('planRevision', 1);
const OWNER = syntheticId('user', 2);
const OTHER = syntheticId('planRevision', 2);

/**
 * Gives the owner the status requires: set exactly for IN_REVIEW and RESOLVED.
 *
 * @param status - The case's status.
 * @returns A synthetic owner ID, or null.
 */
function ownerFor(status: CaseStatus): string | null {
  return status === CaseStatus.Open || status === CaseStatus.Withdrawn ? null : OWNER;
}

describe('openCaseStatusOf', () => {
  it.each([CaseStatus.Open, CaseStatus.InReview])('shows %s for a live case', (status) => {
    const cases = [
      buildAdvisingCase({ status, planRevisionId: REVISION, ownerUserId: ownerFor(status) }),
    ];

    expect(openCaseStatusOf(cases, new Set([REVISION]))).toBe(status);
  });

  it.each([CaseStatus.Resolved, CaseStatus.Withdrawn])('shows null for a %s case', (status) => {
    const cases = [
      buildAdvisingCase({ status, planRevisionId: REVISION, ownerUserId: ownerFor(status) }),
    ];

    expect(openCaseStatusOf(cases, new Set([REVISION]))).toBeNull();
  });

  it('shows null for a live case on another plan or on no revision', () => {
    const cases = [
      buildAdvisingCase({ status: CaseStatus.Open, planRevisionId: OTHER }),
      buildAdvisingCase({
        reason: CaseReason.SourceDiscrepancy,
        discrepancySubject: DiscrepancySubject.CourseAttempt,
        planRevisionId: null,
      }),
    ];

    expect(openCaseStatusOf(cases, new Set([REVISION]))).toBeNull();
  });
});
