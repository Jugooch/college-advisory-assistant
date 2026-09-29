/**
 * @file One requirement in the tree: its state in words, what remains, evidence one interaction
 * away, and its child requirements.
 * @module @caa/web/features/academic-summary/components/requirement-tree-item
 * @requirement FR-04
 * @requirement FR-10
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import type { AcademicSummaryResponse } from '@caa/api-contract';

import { StatusBadge } from '@/components/ui/status-badge';
import type { CourseLookup } from '@/shared/utils/course-display';

import { describeRequirementState } from '../utils/requirement-state-wording';
import type { RequirementNode } from '../utils/requirement-tree';
import { CandidateCourseList } from './candidate-course-list';
import { RequirementRemaining } from './requirement-remaining';

/** Props for {@link RequirementTreeItem}. */
export interface RequirementTreeItemProps {
  readonly node: RequirementNode;
  /** The audit the requirement comes from. */
  readonly audit: NonNullable<AcademicSummaryResponse['audit']>;
  /** Whether every state must be shown as needing verification. */
  readonly isUnverified: boolean;
  /** Catalog display entries by course ID, to name the candidate courses. */
  readonly courses: CourseLookup;
}

/**
 * Renders one requirement and, nested, its children.
 *
 * @param props - The node, its audit, the verification flag, and the display entries.
 * @returns The list item.
 */
export function RequirementTreeItem({
  node,
  audit,
  isUnverified,
  courses,
}: RequirementTreeItemProps): ReactElement {
  const { requirement, children } = node;
  const display = describeRequirementState(requirement.state, {
    auditGeneratedAt: audit.generatedAt,
    isUnverified,
  });
  return (
    <li className="requirement">
      <span className="requirement__label">{requirement.label}</span>{' '}
      <StatusBadge label={display.label} tone={display.tone} />
      {display.explanation === null ? null : <p>{display.explanation}</p>}
      <p>
        Remaining in the audit: <RequirementRemaining requirement={requirement} />
      </p>
      <details>
        <summary>Evidence for {requirement.label}</summary>
        <dl className="facts">
          <dt>Audit</dt>
          <dd>
            <code>
              {audit.auditSource} {audit.auditVersion}
            </code>
          </dd>
          <dt>Audit reference</dt>
          <dd>
            <code>{requirement.sourceRef}</code>
          </dd>
          <dt>Courses the audit lists for it</dt>
          <dd>
            <CandidateCourseList courseIds={requirement.candidateCourseIds} courses={courses} />
          </dd>
        </dl>
      </details>
      {children.length === 0 ? null : (
        <ul>
          {children.map((child) => (
            <RequirementTreeItem
              key={child.requirement.sourceRequirementId}
              node={child}
              audit={audit}
              isUnverified={isUnverified}
              courses={courses}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
