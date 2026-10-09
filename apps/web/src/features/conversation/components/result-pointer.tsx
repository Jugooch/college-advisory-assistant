/**
 * @file Points to the screen that shows a verified result, instead of rendering one in chat.
 * @module @caa/web/features/conversation/components/result-pointer
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

import type { AssistantBlock } from '@caa/api-contract';
import { AssistantBlockKind } from '@caa/domain';

import type { StudentLinks } from '../utils/student-links';

/** Props for {@link ResultPointer}. */
export interface ResultPointerProps {
  readonly block: AssistantBlock;
  readonly links: StudentLinks;
}

/**
 * Points to the screen that shows a verified result, instead of rendering one here.
 *
 * @param props - The block and the links.
 * @returns The pointer text with its link.
 */
export function ResultPointer({ block, links }: ResultPointerProps): ReactElement {
  switch (block.kind) {
    case AssistantBlockKind.ScheduleOptions:
      return (
        <p>
          A schedule search result is ready.{' '}
          <Link href={links.planner}>Open it on the planner</Link>, where every check is shown.
        </p>
      );
    case AssistantBlockKind.PlanEvidence:
      return (
        <p>
          A saved plan is relevant here. <Link href={links.plans}>Open My plans</Link>. A saved plan
          is not a registration.
        </p>
      );
    case AssistantBlockKind.AcademicSummary:
      return (
        <p>
          Your academic summary is relevant here. <Link href={links.overview}>Open Overview</Link>.
        </p>
      );
    default:
      return (
        <p>
          This suggestion isn’t available in chat yet. Use{' '}
          <Link href={links.planner}>the form</Link> or{' '}
          <Link href={links.help}>Help and cases</Link>.
        </p>
      );
  }
}
