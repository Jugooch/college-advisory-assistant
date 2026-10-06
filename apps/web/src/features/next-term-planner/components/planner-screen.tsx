/**
 * @file The planner screen: any error notices, then the form, the review step, or the outcome of
 * a confirmed search.
 * @module @caa/web/features/next-term-planner/components/planner-screen
 * @requirement FR-08
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import { ApiErrorNotice } from '@/shared/components/api-error-notice';
import type { CandidateCourse } from '@/shared/utils/candidate-courses';
import type { CourseLookup } from '@/shared/utils/course-display';
import type { CreditChoices } from '@/shared/utils/credit-choice';

import type { PlannerFormValues } from '../utils/planner-fields';
import type { PlannerView } from '../utils/planner-view';
import { IssueSummary } from './issue-summary';
import { PlannerForm } from './planner-form';
import { ReviewStep } from './review-step';

/** Props for {@link PlannerScreen}. */
export interface PlannerScreenProps {
  readonly studentId: string;
  readonly view: PlannerView;
  readonly values: PlannerFormValues;
  readonly candidates: readonly CandidateCourse[];
  readonly isCandidateListUnavailable: boolean;
  readonly courses: CourseLookup;
  readonly credits: CreditChoices;
}

/**
 * Renders the screen for its view.
 *
 * @param props - The student, the view, and the form's data.
 * @returns The screen content.
 */
export function PlannerScreen({ view, ...form }: PlannerScreenProps): ReactElement {
  const { studentId, values } = form;
  if (view.kind === 'form') {
    const errors = new Map(
      view.issues.flatMap((i) => (i.name === null ? [] : [[i.name, i.message] as const])),
    );
    return (
      <>
        <IssueSummary issues={view.issues} />
        <PlannerForm {...form} errors={errors} />
      </>
    );
  }
  return (
    <>
      {view.kind === 'search-failed' ? (
        <ApiErrorNotice error={view.error} headingId="search-error-heading" />
      ) : null}
      <ReviewStep
        studentId={studentId}
        values={values}
        constraints={view.constraints}
        isRetry={view.kind === 'search-failed'}
      />
    </>
  );
}
