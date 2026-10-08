/**
 * @file Pure rule that picks the open case status a plan shows in the plan list. No I/O, clock,
 * or logging happens here.
 * @module @caa/api/modules/plan-views/plan-views.logic
 * @requirement FR-11
 * @see docs/adr/0008-pure-logic-files.md
 */
import type { AdvisingCase } from '@caa/domain';

import { isLiveCaseStatus, type LiveCaseStatus } from '../cases/cases.logic';

/**
 * Finds the status of the plan's one live case.
 *
 * @param cases - The student's cases.
 * @param revisionIds - The IDs of every revision of the plan.
 * @returns OPEN or IN_REVIEW when a live case froze one of the revisions, else null.
 */
export function openCaseStatusOf(
  cases: readonly AdvisingCase[],
  revisionIds: ReadonlySet<string>,
): LiveCaseStatus | null {
  const found = cases.find(
    ({ status, planRevisionId }) =>
      isLiveCaseStatus(status) && planRevisionId !== null && revisionIds.has(planRevisionId),
  );
  return found !== undefined && isLiveCaseStatus(found.status) ? found.status : null;
}
