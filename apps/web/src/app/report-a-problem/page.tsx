/**
 * @file Report a problem page: a form to tell the advising team that something on the student's
 * record looks wrong. A report changes no official record.
 * @module @caa/web/app/report-a-problem/page
 * @requirement FR-17
 * @requirement NFR-02
 * @see docs/planning/11-ux-and-accessibility-design.md
 */
import type { Metadata } from 'next';
import type { ReactElement } from 'react';

import { createCaseAction } from '@/features/advisor-cases/actions/create-case.action';
import { ReportProblemForm } from '@/features/advisor-cases/components/report-problem-form';
import { readSubjectQuery } from '@/features/advisor-cases/utils/handoff-query';
import { StudentLookupForm } from '@/features/session/components/student-lookup-form';
import { StudentNav } from '@/features/student-navigation/components/student-nav';
import { HandoffQuery } from '@/shared/utils/case-handoff-query';
import { REPORT_CHANGES_NOTHING } from '@/shared/utils/case-wording';
import { readStudentIdQuery } from '@/shared/utils/student-id-query';

/** Page title. */
export const metadata: Metadata = { title: 'Report a problem with my record' };

/**
 * Renders the report form, or the lookup form when no valid student is named.
 *
 * @param props - The page's search params.
 * @returns The page element.
 */
export default async function ReportAProblemPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const params = await searchParams;
  const query = readStudentIdQuery(params[HandoffQuery.StudentId]);
  if (query.kind !== 'valid') {
    return (
      <>
        <h1>Report a problem with my record</h1>
        <StudentLookupForm idError={query.kind === 'invalid' ? 'invalid' : null} />
      </>
    );
  }
  return (
    <>
      <StudentNav studentId={query.studentId} current={null} />
      <h1>Report a problem with my record</h1>
      <p>{REPORT_CHANGES_NOTHING}</p>
      <ReportProblemForm
        createAction={createCaseAction}
        studentId={query.studentId}
        initialSubject={readSubjectQuery(params[HandoffQuery.Subject])}
        casesHref={`/help-and-cases?studentId=${query.studentId}`}
      />
    </>
  );
}
