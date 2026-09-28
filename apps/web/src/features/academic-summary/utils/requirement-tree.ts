/**
 * @file Arranges the audit's flat requirement list into its parent-child tree for display.
 * @module @caa/web/features/academic-summary/utils/requirement-tree
 * @requirement FR-04
 */
import type { AcademicSummaryResponse } from '@caa/api-contract';

/** One requirement as the summary returns it. */
export type SummaryRequirement = AcademicSummaryResponse['requirements'][number];

/** A requirement with its child requirements, in audit order. */
export interface RequirementNode {
  readonly requirement: SummaryRequirement;
  readonly children: readonly RequirementNode[];
}

/**
 * Builds the requirement tree from parent references. Order within each level is the audit's.
 *
 * @param requirements - The summary's requirements. The contract guarantees unique IDs and that
 *   every parent is listed.
 * @returns The top-level requirements, each with its descendants.
 */
export function buildRequirementTree(
  requirements: readonly SummaryRequirement[],
): readonly RequirementNode[] {
  const childrenOf = (parentId: string | null): readonly RequirementNode[] =>
    requirements
      .filter((requirement) => requirement.parentSourceRequirementId === parentId)
      .map((requirement) => ({
        requirement,
        children: childrenOf(requirement.sourceRequirementId),
      }));
  return childrenOf(null);
}
