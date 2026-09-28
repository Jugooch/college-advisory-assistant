/**
 * @file Finds requirements of an audit that candidate courses may compete for.
 * @module @caa/engine/verification/find-allocation-contests
 * @requirement FR-05
 * @requirement FR-09
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  type AuditSnapshot,
  type CourseId,
  type RequirementResult,
  RequirementState,
} from '@caa/domain';

import { type CourseSelection, maxCreditsOf } from './candidate-set';
import {
  createDecidingRequirementLookup,
  type DecidingRequirement,
} from './find-deciding-requirement';

/** A requirement whose share of the candidate set the engine can't prove the audit absorbs. */
export interface AllocationContest {
  readonly requirement: RequirementResult;
  /** The state deciding the requirement, from itself or an ancestor. */
  readonly deciding: DecidingRequirement;
  /** The competing candidates the requirement lists, in candidate-set order. */
  readonly courseIds: readonly CourseId[];
}

/** A requirement a candidate may still count toward, and the candidates it lists. */
interface OpenRequirement {
  readonly requirement: RequirementResult;
  readonly deciding: DecidingRequirement;
  readonly listed: readonly CourseSelection[];
  /** The requirement and its ancestors, by `sourceRequirementId`. */
  readonly chainIds: ReadonlySet<string>;
}

/**
 * Finds the requirements, in audit order, that candidates compete for. A requirement is
 * contested when either:
 * - it lists two or more candidates and its own remaining quantity isn't proven to absorb all
 *   of them (see `absorbsAll`), whether or not it is reusable; or
 * - it lists a candidate that another open requirement off its own chain of ancestors also
 *   lists, unless both requirements are reusable.
 *
 * Open requirements are those whose deciding state isn't COMPLETE: a course adds nothing to a
 * requirement settled by itself or an ancestor, which applicability reports.
 *
 * @param selections - The candidate set, already validated.
 * @param audit - The authoritative audit snapshot.
 * @returns Every contested requirement; empty when no candidates compete.
 */
export function findAllocationContests(
  selections: readonly CourseSelection[],
  audit: AuditSnapshot,
): readonly AllocationContest[] {
  const open = openRequirementsOf(selections, audit);
  return open.flatMap((entry) => {
    const contested = new Set<CourseId>();
    // SAFETY: extra courses a requirement can't absorb don't advance it, so a plan must not
    // treat them all as satisfying it (planning/08 §Candidate formation: two courses can
    // compete for a single credit bucket; AC05). Reuse lets one course count toward several
    // requirements; it gives no requirement more room, so it doesn't lift this conflict.
    if (entry.listed.length >= 2 && !absorbsAll(entry)) {
      entry.listed.forEach((selection) => contested.add(selection.course.id));
    }
    for (const selection of entry.listed) {
      if (open.some((other) => competesFor(entry, other, selection.course.id))) {
        contested.add(selection.course.id);
      }
    }
    const courseIds = entry.listed
      .map((selection) => selection.course.id)
      .filter((courseId) => contested.has(courseId));
    return courseIds.length === 0
      ? []
      : [{ requirement: entry.requirement, deciding: entry.deciding, courseIds }];
  });
}

/**
 * Lists the open requirements that list at least one candidate, in audit order.
 *
 * @param selections - The candidate set.
 * @param audit - The audit snapshot.
 * @returns The open requirements with their listed candidates and ancestor chains.
 */
function openRequirementsOf(
  selections: readonly CourseSelection[],
  audit: AuditSnapshot,
): readonly OpenRequirement[] {
  const findDeciding = createDecidingRequirementLookup(audit);
  const parentById = new Map(
    audit.requirements.map((node) => [node.sourceRequirementId, node.parentSourceRequirementId]),
  );
  return audit.requirements.flatMap((requirement) => {
    // SAFETY: only the exact course IDs the audit lists are candidates; equivalents and
    // related requirements never add candidacy (planning/08 §Candidate formation).
    const listed = selections.filter((selection) =>
      requirement.candidateCourseIds.includes(selection.course.id),
    );
    const deciding = findDeciding(requirement);
    if (listed.length === 0 || deciding.state === RequirementState.Complete) {
      return [];
    }
    return [{ requirement, deciding, listed, chainIds: chainIdsOf(requirement, parentById) }];
  });
}

/**
 * Whether a second open requirement also lists a course, so the audit must choose one of them.
 *
 * @param entry - The requirement being checked.
 * @param other - Another open requirement.
 * @param courseId - A candidate `entry` lists.
 * @returns `true` when `other` lists the course, isn't on `entry`'s chain, and they don't both
 *   allow reuse.
 */
function competesFor(entry: OpenRequirement, other: OpenRequirement, courseId: CourseId): boolean {
  // SAFETY: a course that isn't reusable counts toward one requirement only, and the audit,
  // not the engine, decides which; so neither requirement may be shown as satisfied by it
  // (planning/08 §Authority and result semantics, §Candidate formation; AC05). A course in
  // a requirement also counts within that requirement's ancestors, so a shared chain isn't a
  // competition; ancestors' quantities are not combined here.
  const isOffChain =
    !entry.chainIds.has(other.requirement.sourceRequirementId) &&
    !other.chainIds.has(entry.requirement.sourceRequirementId);
  return (
    isOffChain &&
    other.listed.some((selection) => selection.course.id === courseId) &&
    !(entry.requirement.isReusable && other.requirement.isReusable)
  );
}

/**
 * Whether a requirement's remaining quantity provably absorbs every candidate it lists, under
 * any allocation the audit may choose.
 *
 * @param entry - An open requirement listing two or more candidates.
 * @returns `true` only when the requirement is itself INCOMPLETE, isn't decided AMBIGUOUS, has
 *   at least one remaining quantity, and every non-null quantity fits: the number of listed
 *   candidates for `remainingCourseCount`, and the sum of their largest possible credits for
 *   `remainingCreditsHundredths`.
 */
function absorbsAll(entry: OpenRequirement): boolean {
  const { requirement, deciding, listed } = entry;
  // SAFETY: an IN_PROGRESS requirement's remaining quantity may or may not already net its
  // in-progress work, and an AMBIGUOUS one isn't settled, so neither proves room.
  if (
    requirement.state !== RequirementState.Incomplete ||
    deciding.state === RequirementState.Ambiguous
  ) {
    return false;
  }
  const { remainingCourseCount: courses, remainingCreditsHundredths: credits } = requirement;
  // SAFETY: a null quantity is unknown, not unlimited (requirement-result.model.ts), so with
  // no quantity at all the requirement's room can't be proven.
  if (courses === null && credits === null) {
    return false;
  }
  // SAFETY: each candidate's largest possible credits are an upper bound, so a fit is proven
  // whatever value a variable-credit course is given; counting every listed candidate, even one
  // another requirement could take, only overstates demand and never hides a conflict.
  const creditDemand = listed.reduce((sum, selection) => sum + maxCreditsOf(selection), 0);
  return (
    (courses === null || listed.length <= courses) && (credits === null || creditDemand <= credits)
  );
}

/**
 * Lists the `sourceRequirementId`s of a requirement and its ancestors.
 *
 * @param requirement - The starting requirement.
 * @param parentById - The parent of every requirement in the audit.
 * @returns The IDs on the chain. Stops at a repeated ID, which the audit schema already rejects.
 */
function chainIdsOf(
  requirement: RequirementResult,
  parentById: ReadonlyMap<string, string | null>,
): ReadonlySet<string> {
  const chainIds = new Set<string>();
  let current: string | null = requirement.sourceRequirementId;
  while (current !== null && !chainIds.has(current)) {
    chainIds.add(current);
    current = parentById.get(current) ?? null;
  }
  return chainIds;
}
