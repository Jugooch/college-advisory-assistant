/**
 * @file The evidence behind one check, one interaction away: source reference, ruleset, rule
 * leaves, courses, and credit arithmetic.
 * @module @caa/web/shared/components/check-evidence
 * @requirement FR-10
 * @requirement NFR-02
 */
import type { ReactElement, ReactNode } from 'react';

import type { CheckResult } from '@caa/domain';

import { CourseLabel } from '@/shared/components/course-label';
import { type CampusLookup, describeCampus } from '@/shared/utils/campus-display';
import type { CourseLookup } from '@/shared/utils/course-display';
import { describeCreditLoad, describeLeaf } from '@/shared/utils/decisive-leaf-wording';
import { describeReason } from '@/shared/utils/reason-code-wording';

/** Props for {@link CheckEvidence}. */
export interface CheckEvidenceProps {
  /** Name of the dimension, used in the disclosure label. */
  readonly dimension: string;
  readonly check: CheckResult;
  /** Catalog display entries by course ID, to name the courses in the evidence. */
  readonly courses: CourseLookup;
  /** Campus names by ID, to name the campuses in schedule issues. */
  readonly campuses: CampusLookup;
}

/** One term and its detail in the evidence list. */
interface Fact {
  readonly term: string;
  readonly detail: ReactNode;
}

/**
 * Lists the source reference and ruleset of a check.
 *
 * @param check - The check.
 * @returns Zero to two facts.
 */
function provenanceFacts(check: CheckResult): readonly Fact[] {
  const facts: Fact[] = [];
  if (check.sourceRef !== undefined) {
    facts.push({ term: 'Source reference', detail: <code>{check.sourceRef}</code> });
  }
  if (check.evidence !== undefined) {
    const ruleset = check.evidence.rulesetVersion ?? 'No published ruleset applied';
    facts.push({ term: 'Ruleset', detail: ruleset });
  }
  return facts;
}

type ScheduleIssues = NonNullable<NonNullable<CheckResult['evidence']>['scheduleIssues']>;

/**
 * Lists the schedule issues of a check's evidence, with courses and campuses named.
 *
 * @param issues - The check's schedule issues.
 * @param courses - Catalog display entries by course ID.
 * @param campuses - Campus names by ID.
 * @returns One fact, or none when there are no issues.
 */
function scheduleIssueFacts(
  issues: ScheduleIssues,
  courses: CourseLookup,
  campuses: CampusLookup,
): readonly Fact[] {
  if (issues.length === 0) {
    return [];
  }
  // SAFETY: schedule issues are shown only through the fixed reason-code wording.
  const items = issues.map((issue, index) => (
    <li key={`${String(index)}-${issue.reasonCode}`}>
      {'courseId' in issue ? <CourseLabel courseId={issue.courseId} courses={courses} /> : null}
      {'courseId' in issue ? ': ' : null}
      {describeReason(issue.reasonCode).explanation}
      {'fromCampusId' in issue ? (
        <>
          {' '}
          Between campus {describeCampus(issue.fromCampusId, campuses)} and campus{' '}
          {describeCampus(issue.toCampusId, campuses)}.
        </>
      ) : null}
      {'campusId' in issue ? <> Campus: {describeCampus(issue.campusId, campuses)}.</> : null}
    </li>
  ));
  return [{ term: 'Schedule issues', detail: <ul>{items}</ul> }];
}

/**
 * Lists the rule leaves, courses, and credit arithmetic of a check's evidence.
 *
 * @param evidence - The check's evidence.
 * @param courses - Catalog display entries by course ID.
 * @param campuses - Campus names by ID.
 * @returns Zero to three facts.
 */
function detailFacts(
  evidence: NonNullable<CheckResult['evidence']>,
  courses: CourseLookup,
  campuses: CampusLookup,
): readonly Fact[] {
  const facts: Fact[] = [];
  if (evidence.decisiveLeaves.length > 0) {
    const leaves = evidence.decisiveLeaves.map((leaf) => (
      <li key={leaf.path.join('.')}>
        {describeLeaf(leaf, courses)}
        {leaf.reasonCode === null ? null : `: ${describeReason(leaf.reasonCode).explanation}`}
      </li>
    ));
    facts.push({ term: 'Rule parts that decided it', detail: <ul>{leaves}</ul> });
  }
  facts.push(...scheduleIssueFacts(evidence.scheduleIssues ?? [], courses, campuses));
  const courseIds = evidence.courseIds ?? [];
  if (courseIds.length > 0) {
    const names = courseIds.map((courseId) => (
      <li key={courseId}>
        <CourseLabel courseId={courseId} courses={courses} />
      </li>
    ));
    facts.push({ term: 'Courses involved', detail: <ul>{names}</ul> });
  }
  if (evidence.creditLoad !== undefined && evidence.creditLoad !== null) {
    facts.push({ term: 'Credit arithmetic', detail: describeCreditLoad(evidence.creditLoad) });
  }
  return facts;
}

/**
 * Renders the evidence in a disclosure.
 *
 * @param props - The dimension name, the check, and the display entries.
 * @returns The details element.
 */
export function CheckEvidence({
  dimension,
  check,
  courses,
  campuses,
}: CheckEvidenceProps): ReactElement {
  const facts = [
    ...provenanceFacts(check),
    ...(check.evidence === undefined ? [] : detailFacts(check.evidence, courses, campuses)),
  ];
  return (
    <details>
      <summary>Evidence for {dimension}</summary>
      {facts.length === 0 ? (
        <p>No evidence was attached to this check.</p>
      ) : (
        <dl className="facts">
          {facts.map(({ term, detail }) => (
            <div key={term} className="facts__row">
              <dt>{term}</dt>
              <dd>{detail}</dd>
            </div>
          ))}
        </dl>
      )}
    </details>
  );
}
