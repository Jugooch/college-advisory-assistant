/**
 * @file Next-term planner page: state the term, courses, and constraints, review them, and
 * confirm before any search.
 * @module @caa/web/app/next-term-planner/page
 * @requirement FR-08
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import {
  type AcademicSummaryResponse,
  ApiError,
  type ConversationResponse,
  type PlannableTermsResponse,
  type ScheduleOptionsRequest,
} from '@caa/api-contract';

import { getAcademicSummary } from '@/api/academic-summary.api';
import { getConversation } from '@/api/conversation.api';
import { getPlannableTerms } from '@/api/plannable-terms.api';
import { findScheduleOptions } from '@/api/schedule-options.api';
import { clearConversationAction } from '@/features/conversation/actions/clear-conversation.action';
import { sendTurnAction } from '@/features/conversation/actions/send-turn.action';
import {
  ChatSection,
  type ChatSectionProps,
} from '@/features/conversation/components/chat-section';
import { readChatTerm } from '@/features/conversation/utils/chat-term';
import { PlannerScreen } from '@/features/next-term-planner/components/planner-screen';
import { planScheduleRequest } from '@/features/next-term-planner/utils/planner-plan';
import {
  readPlannerQuery,
  type SearchParams,
} from '@/features/next-term-planner/utils/planner-query';
import {
  confirmedRequest,
  type PlannerView,
  planPlannerView,
} from '@/features/next-term-planner/utils/planner-view';
import { savePlanDraftAction } from '@/features/plan-drafts/actions/save-plan-draft.action';
import { bindOptionDraftControl } from '@/features/plan-drafts/components/option-draft-control';
import { StudentLookupForm } from '@/features/session/components/student-lookup-form';
import { StudentNav } from '@/features/student-navigation/components/student-nav';
import { ApiErrorNotice } from '@/shared/components/api-error-notice';
import { ScheduleResults } from '@/shared/components/schedule-results';
import { planCandidateCourses } from '@/shared/utils/candidate-courses';
import { type CourseLookup, summaryCourses } from '@/shared/utils/course-display';
import { keepApiError } from '@/shared/utils/keep-api-error';

/** Page title. */
export const metadata: Metadata = { title: 'Plan next term' };

/** Render on every request: results are for the student's current pinned data. */
export const dynamic = 'force-dynamic';

/**
 * Loads the transcript for the form's term, if it has a valid one. A failure is returned, not
 * thrown, so the form still renders.
 *
 * @param studentId - Internal student ID from the page URL.
 * @param termText - The term text from the query.
 * @returns The conversation, the API's error, or `null` when no valid term is chosen.
 */
async function loadConversation(
  studentId: string,
  termText: string,
): Promise<ConversationResponse | ApiError | null> {
  const termId = readChatTerm(termText);
  return termId === null ? null : keepApiError(getConversation(studentId, { termId }));
}

/**
 * The chat column with its actions bound. The form never depends on it.
 *
 * @param props - The student, the form's term, the loaded conversation and confirmed inputs.
 * @returns The chat column.
 */
function ChatBeside(props: Omit<ChatSectionProps, 'sendAction' | 'clearAction'>): ReactElement {
  return (
    <ChatSection {...props} sendAction={sendTurnAction} clearAction={clearConversationAction} />
  );
}

/**
 * Shows an error notice for each lookup that failed; the form still renders.
 *
 * @param props - The summary and terms outcomes.
 * @returns The notices.
 */
function LoadNotices({
  summary,
  terms,
}: {
  readonly summary: AcademicSummaryResponse | ApiError;
  readonly terms: PlannableTermsResponse | ApiError;
}): ReactElement {
  return (
    <>
      {summary instanceof ApiError ? (
        <ApiErrorNotice error={summary} headingId="summary-error-heading" />
      ) : null}
      {terms instanceof ApiError ? (
        <ApiErrorNotice error={terms} headingId="terms-error-heading" />
      ) : null}
    </>
  );
}

/**
 * Shows the search result with its save-as-draft control.
 *
 * @param props - The view, the confirmed request, the courses and the student.
 * @returns The results, or nothing when no search ran.
 */
function SearchResults({
  view,
  request,
  courses,
  studentId,
}: {
  readonly view: PlannerView;
  readonly request: ScheduleOptionsRequest | null;
  readonly courses: CourseLookup;
  readonly studentId: string;
}): ReactElement | null {
  if (view.kind !== 'searched' || request === null) {
    return null;
  }
  return (
    <ScheduleResults
      result={view.result}
      courses={courses}
      renderSaveDraft={bindOptionDraftControl({
        saveAction: savePlanDraftAction,
        studentId,
        request,
        result: view.result,
      })}
    />
  );
}

/**
 * Renders the planner step the query asks for.
 *
 * @param props - The page's search params.
 * @returns The page element.
 */
export default async function NextTermPlannerPage({
  searchParams,
}: {
  readonly searchParams: Promise<SearchParams>;
}): Promise<ReactElement> {
  const { student, step, values } = readPlannerQuery(await searchParams);
  if (student.kind !== 'valid') {
    return (
      <>
        <h1>Plan next term</h1>
        <StudentLookupForm idError={student.kind === 'invalid' ? 'invalid' : null} />
      </>
    );
  }
  // The summary comes first: its catalog entries give each variable-credit course's range.
  const summary = await keepApiError(getAcademicSummary(student.studentId));
  const terms = await keepApiError(getPlannableTerms(student.studentId));
  const conversation = await loadConversation(student.studentId, values.termId);
  const isSummaryFailed = summary instanceof ApiError;
  const courses = summaryCourses(summary);
  const plan = planScheduleRequest(values, courses);
  const request = confirmedRequest(step, plan);
  const outcome =
    request === null ? null : await keepApiError(findScheduleOptions(student.studentId, request));
  const view = planPlannerView(step, plan, outcome);
  return (
    <>
      <StudentNav studentId={student.studentId} current="next-term-planner" />
      <h1>Plan next term</h1>
      <p>Set up a search for next term. Nothing here registers you or changes your record.</p>
      <LoadNotices summary={summary} terms={terms} />
      <SearchResults
        view={view}
        request={request}
        courses={courses}
        studentId={student.studentId}
      />
      <div className="planner-layout">
        <div>
          <PlannerScreen
            studentId={student.studentId}
            view={view}
            values={values}
            candidates={planCandidateCourses(summary, values.courseIds)}
            isCandidateListUnavailable={isSummaryFailed}
            courses={courses}
            terms={terms instanceof ApiError ? null : terms.terms}
            credits={{ inputs: values.creditInputs, errors: plan.creditErrors }}
          />
        </div>
        <ChatBeside
          studentId={student.studentId}
          termId={values.termId}
          conversation={conversation}
          plannerInputs={request}
        />
      </div>
    </>
  );
}
