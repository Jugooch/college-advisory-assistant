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

/**
 * Lists the rule leaves, courses, and credit arithmetic of a check's evidence.
 *
 * @param evidence - The check's evidence.
 * @param courses - Catalog display entries by course ID.
 * @returns Zero to three facts.
 */
function detailFacts(
  evidence: NonNullable<CheckResult['evidence']>,
  courses: CourseLookup,
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
  const issues = evidence.scheduleIssues ?? [];
  if (issues.length > 0) {
    // SAFETY: schedule issues are shown only through the fixed reason-code wording.
    const items = issues.map((issue, index) => (
      <li key={`${String(index)}-${issue.reasonCode}`}>
        {'courseId' in issue ? <CourseLabel courseId={issue.courseId} courses={courses} /> : null}
        {'courseId' in issue ? ': ' : null}
        {describeReason(issue.reasonCode).explanation}
      </li>
    ));
    facts.push({ term: 'Schedule issues', detail: <ul>{items}</ul> });
  }
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
export function CheckEvidence({ dimension, check, courses }: CheckEvidenceProps): ReactElement {
  const facts = [
    ...provenanceFacts(check),
    ...(check.evidence === undefined ? [] : detailFacts(check.evidence, courses)),
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
