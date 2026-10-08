'use client';
/**
 * @file Writes a confirmed constraint into the planner form by changing the page's query. The
 * form is filled and shown for review; no search runs.
 * @module @caa/web/features/conversation/hooks/use-fill-planner
 * @requirement FR-08
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { useRouter, useSearchParams } from 'next/navigation';

import type { ScheduleConstraint } from '@caa/domain';

import { fillPlannerQuery, type FillResult } from '@/shared/utils/constraint-fill';

/**
 * Gives the function that fills one constraint into the form.
 *
 * @returns A function that fills the form, or reports why it can't.
 */
export function useFillPlanner(): (constraint: ScheduleConstraint) => FillResult {
  const router = useRouter();
  const search = useSearchParams();
  return (constraint) => {
    const result = fillPlannerQuery(new URLSearchParams(search.toString()), constraint);
    if (result.kind === 'filled') {
      router.replace(`/next-term-planner?${result.params.toString()}`, { scroll: false });
    }
    return result;
  };
}
