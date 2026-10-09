/**
 * @file A flat table of every requirement: the text alternative to the requirement tree.
 * @module @caa/web/shared/components/requirement-table
 * @requirement FR-04
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import type { AcademicSummaryResponse } from '@caa/api-contract';

import { describeRequirementState } from '@/shared/utils/requirement-state-wording';
import type { SummaryRequirement } from '@/shared/utils/requirement-tree';

import { RequirementRemaining } from './requirement-remaining';

/** Props for {@link RequirementTable}. */
export interface RequirementTableProps {
  readonly requirements: readonly SummaryRequirement[];
  readonly audit: NonNullable<AcademicSummaryResponse['audit']>;
  /** Whether every state must be shown as needing verification. */
  readonly isUnverified: boolean;
}

/**
 * Renders the requirements in audit order with their parent named in a column.
 *
 * @param props - Requirements, their audit, and the verification flag.
 * @returns The table.
 */
export function RequirementTable({
  requirements,
  audit,
  isUnverified,
}: RequirementTableProps): ReactElement {
  const labelOf = new Map(requirements.map((item) => [item.sourceRequirementId, item.label]));
  return (
    <table>
      <caption>Requirements in audit order</caption>
      <thead>
        <tr>
          <th scope="col">Requirement</th>
          <th scope="col">Part of</th>
          <th scope="col">State</th>
          <th scope="col">Remaining in the audit</th>
          <th scope="col">Audit reference</th>
        </tr>
      </thead>
      <tbody>
        {requirements.map((requirement) => (
          <tr key={requirement.sourceRequirementId}>
            <th scope="row">{requirement.label}</th>
            <td>
              {requirement.parentSourceRequirementId === null
                ? 'Top level'
                : labelOf.get(requirement.parentSourceRequirementId)}
            </td>
            <td>
              {
                describeRequirementState(requirement.state, {
                  auditGeneratedAt: audit.generatedAt,
                  isUnverified,
                }).label
              }
            </td>
            <td>
              <RequirementRemaining requirement={requirement} />
            </td>
            <td>
              <code>{requirement.sourceRef}</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
