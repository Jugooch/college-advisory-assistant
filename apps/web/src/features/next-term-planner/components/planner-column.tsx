/**
 * @file The planner form column: derives the form's candidate courses, terms and credit inputs
 * from the page's lookups, so the page only fetches and composes.
 * @module @caa/web/features/next-term-planner/components/planner-column
 * @requirement FR-08
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import {
  type AcademicSummaryResponse,
  ApiError,
  type PlannableTermsResponse,
} from '@caa/api-contract';

import { planCandidateCourses } from '@/shared/utils/candidate-courses';
import { summaryCourses } from '@/shared/utils/course-display';

import type { PlannerFormValues } from '../utils/planner-fields';
import type { PlannerPlan } from '../utils/planner-plan';
import type { PlannerView } from '../utils/planner-view';
import { PlannerScreen } from './planner-screen';

/** Props for {@link PlannerColumn}. */
export interface PlannerColumnProps {
  readonly studentId: string;
  readonly view: PlannerView;
  readonly values: PlannerFormValues;
  /** The plan of the typed values, for its credit errors. */
  readonly plan: PlannerPlan;
  /** The summary, or the error its lookup returned. */
  readonly summary: AcademicSummaryResponse | ApiError;
  /** The plannable terms, or the error their lookup returned. */
  readonly terms: PlannableTermsResponse | ApiError;
}

/**
 * Renders the planner screen with the lookups turned into its inputs.
 *
 * @param props - The student, view, typed values, plan and lookups.
 * @returns The column.
 */
export function PlannerColumn({
  studentId,
  view,
  values,
  plan,
  summary,
  terms,
}: PlannerColumnProps): ReactElement {
  return (
    <div>
      <PlannerScreen
        studentId={studentId}
        view={view}
        values={values}
        candidates={planCandidateCourses(summary, values.courseIds)}
        isCandidateListUnavailable={summary instanceof ApiError}
        courses={summaryCourses(summary)}
        terms={terms instanceof ApiError ? null : terms.terms}
        credits={{ inputs: values.creditInputs, errors: plan.creditErrors }}
      />
    </div>
  );
}
