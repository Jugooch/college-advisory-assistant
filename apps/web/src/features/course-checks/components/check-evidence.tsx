/**
 * @file The evidence behind one check, one interaction away: source reference, ruleset, rule
 * leaves, courses, and credit arithmetic.
 * @module @caa/web/features/course-checks/components/check-evidence
 * @requirement FR-10
 * @requirement NFR-02
 */
import type { ReactElement, ReactNode } from 'react';

import type { CheckResult } from '@caa/domain';

import { describeReason } from '@/shared/utils/reason-code-wording';

import { describeCreditLoad, describeLeaf } from '../utils/decisive-leaf-wording';

/** Props for {@link CheckEvidence}. */
export interface CheckEvidenceProps {
  /** Name of the dimension, used in the disclosure label. */
  readonly dimension: string;
  readonly check: CheckResult;
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
 * @returns Zero to three facts.
 */
function detailFacts(evidence: NonNullable<CheckResult['evidence']>): readonly Fact[] {
  const facts: Fact[] = [];
  if (evidence.decisiveLeaves.length > 0) {
    const leaves = evidence.decisiveLeaves.map((leaf) => (
      <li key={leaf.path.join('.')}>
        {describeLeaf(leaf)}
        {leaf.reasonCode === null ? null : `: ${describeReason(leaf.reasonCode).explanation}`}
      </li>
    ));
    facts.push({ term: 'Rule parts that decided it', detail: <ul>{leaves}</ul> });
  }
  const courseIds = evidence.courseIds ?? [];
  if (courseIds.length > 0) {
    const codes = courseIds.map((courseId) => <code key={courseId}>{courseId} </code>);
    facts.push({ term: 'Courses involved', detail: codes });
  }
  if (evidence.creditLoad !== undefined && evidence.creditLoad !== null) {
    facts.push({ term: 'Credit arithmetic', detail: describeCreditLoad(evidence.creditLoad) });
  }
  return facts;
}

/**
 * Renders the evidence in a disclosure.
 *
 * @param props - The dimension name and the check.
 * @returns The details element.
 */
export function CheckEvidence({ dimension, check }: CheckEvidenceProps): ReactElement {
  const facts = [
    ...provenanceFacts(check),
    ...(check.evidence === undefined ? [] : detailFacts(check.evidence)),
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
