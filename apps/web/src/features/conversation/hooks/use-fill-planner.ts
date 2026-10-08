'use client';
/**
 * @file Writes a confirmed constraint into the planner form by changing the page's query. The
 * form is filled and shown for review; no search runs. A fill starts from the form's live
 * values and from the last fill not yet in the URL, so typed text and quick repeated Confirms
 * are both kept.
 * @module @caa/web/features/conversation/hooks/use-fill-planner
 * @requirement FR-08
 * @requirement NFR-02
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import type { ScheduleConstraint } from '@caa/domain';

import { PLANNER_FORM_ID } from '@/shared/utils/planner-form-id';

import { readLivePlannerQuery } from '../utils/live-planner-query';
import { fillPlannerQuery, type FillResult } from '../utils/planner-fill';

/** What {@link useFillPlanner} returns. */
export interface PlannerFill {
  /** Fills one constraint into the form, or reports why it can't. */
  readonly fill: (constraint: ScheduleConstraint) => FillResult;
  /** Whether the form already holds this constraint. */
  readonly isFilled: (constraint: ScheduleConstraint) => boolean;
}

/**
 * Finds the planner form in the page, if it is shown.
 *
 * @returns The form, or `null`.
 */
function findPlannerForm(): HTMLFormElement | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const element = document.getElementById(PLANNER_FORM_ID);
  return element instanceof HTMLFormElement ? element : null;
}

/**
 * Gives the functions that fill one constraint into the form and check whether it is there.
 *
 * @returns The fill and check functions.
 */
export function useFillPlanner(): PlannerFill {
  const router = useRouter();
  const search = useSearchParams();
  const queryText = search.toString();
  // The query last written but not yet reflected in the page's URL.
  const written = useRef<URLSearchParams | null>(null);
  useEffect(() => {
    written.current = null;
  }, [queryText]);
  const base = (): URLSearchParams =>
    written.current ?? readLivePlannerQuery(new URLSearchParams(queryText), findPlannerForm());
  return {
    fill: (constraint) => {
      const result = fillPlannerQuery(base(), constraint);
      if (result.kind === 'filled') {
        written.current = result.params;
        router.replace(`/next-term-planner?${result.params.toString()}`, { scroll: false });
      }
      return result;
    },
    isFilled: (constraint) => fillPlannerQuery(base(), constraint).kind === 'present',
  };
}
