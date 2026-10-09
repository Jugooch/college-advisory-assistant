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

import { getAcademicSummary } from '@/api/academic-summary.api';
import { getConversation } from '@/api/conversation.api';
import { getPlannableTerms } from '@/api/plannable-terms.api';
import { findScheduleOptions } from '@/api/schedule-options.api';
import { clearConversationAction } from '@/features/conversation/actions/clear-conversation.action';
import { reloadConversationAction } from '@/features/conversation/actions/reload-conversation.action';
import { sendTurnAction } from '@/features/conversation/actions/send-turn.action';
import { ChatSection } from '@/features/conversation/components/chat-section';
import { readChatTerm } from '@/features/conversation/utils/chat-term';
import { LoadNotices } from '@/features/next-term-planner/components/load-notices';
import { PlannerColumn } from '@/features/next-term-planner/components/planner-column';
import { planScheduleRequest } from '@/features/next-term-planner/utils/planner-plan';
import {
  readPlannerQuery,
  type SearchParams,
} from '@/features/next-term-planner/utils/planner-query';
import { confirmedRequest, planPlannerView } from '@/features/next-term-planner/utils/planner-view';
import { savePlanDraftAction } from '@/features/plan-drafts/actions/save-plan-draft.action';
import { bindOptionDraftControl } from '@/features/plan-drafts/components/option-draft-control';
import { StudentLookupScreen } from '@/features/session/components/student-lookup-screen';
import { StudentNav } from '@/features/student-navigation/components/student-nav';
import { ScheduleResults } from '@/shared/components/schedule-results';
import { summaryCourses } from '@/shared/utils/course-display';
import { keepApiError } from '@/shared/utils/keep-api-error';

/** Page title. */
export const metadata: Metadata = { title: 'Plan next term' };

/** Render on every request: results are for the student's current pinned data. */
export const dynamic = 'force-dynamic';

/** The chat panel's three server actions. */
const CHAT_ACTIONS = {
  sendAction: sendTurnAction,
  reloadAction: reloadConversationAction,
  clearAction: clearConversationAction,
};

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
    return <StudentLookupScreen title="Plan next term" isIdInvalid={student.kind === 'invalid'} />;
  }
  const studentId = student.studentId;
  // The summary's catalog entries give each variable-credit course's range, used below.
  // The two lookups don't depend on each other, so they run together.
  const [summary, terms] = await Promise.all([
    keepApiError(getAcademicSummary(studentId)),
    keepApiError(getPlannableTerms(studentId)),
  ]);
  const termId = readChatTerm(values.termId);
  const chat = termId === null ? null : await keepApiError(getConversation(studentId, { termId }));
  const courses = summaryCourses(summary);
  const plan = planScheduleRequest(values, courses);
  const request = confirmedRequest(step, plan);
  const found =
    request === null ? null : await keepApiError(findScheduleOptions(studentId, request));
  const view = planPlannerView(step, plan, found);
  return (
    <>
      <StudentNav studentId={studentId} current="next-term-planner" />
      <h1>Plan next term</h1>
      <p>Set up a search for next term. Nothing here registers you or changes your record.</p>
      <LoadNotices summary={summary} terms={terms} />
      {view.kind === 'searched' && request !== null ? (
        <ScheduleResults
          result={view.result}
          courses={courses}
          renderSaveDraft={bindOptionDraftControl({
            saveAction: savePlanDraftAction,
            studentId: studentId,
            request,
            result: view.result,
          })}
        />
      ) : null}
      <div className="planner-layout">
        <PlannerColumn
          studentId={studentId}
          view={view}
          values={values}
          plan={plan}
          summary={summary}
          terms={terms}
        />
        <ChatSection
          studentId={studentId}
          termId={values.termId}
          conversation={chat}
          plannerInputs={request}
          {...CHAT_ACTIONS}
        />
      </div>
    </>
  );
}
