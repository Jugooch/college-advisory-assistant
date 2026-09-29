/**
 * @file Tests that course-check results show each dimension separately, in words, with the next
 * step for CONDITIONAL and UNKNOWN, courses by catalog code, and never as a single approval or a
 * registration.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { type CourseChecksResponse, CourseChecksResponseSchema } from '@caa/api-contract';
import { AggregateState, CheckKind, CheckState, ReasonCode } from '@caa/domain';
import { buildCheckResult, SYNTHETIC_COURSES, syntheticId } from '@caa/test-kit';

import { indexCourses } from '@/shared/utils/course-display';

import { CourseCheckResults } from './course-check-results';

const { math101, math102, ind390 } = SYNTHETIC_COURSES;
const PINNED = {
  studentSnapshotId: syntheticId('studentSnapshot', 1),
  studentRecordEffectiveAt: '2026-09-12T14:00:00Z',
  auditRecordEffectiveAt: '2026-09-10T09:00:00Z',
  auditSource: 'demo-audit',
  auditVersion: 'audit_demo_r7',
  rulesetVersion: 'demo-2026.1',
};
const PASSED =
  'Passed as of Sep 12, 2026, 2:00 PM UTC (record) and Sep 10, 2026, 9:00 AM UTC (audit)';

/**
 * A result with a CONDITIONAL prerequisite, no rule on one course, and two UNKNOWN checks. Both
 * checked courses have catalog entries; the prerequisite course has none.
 */
const MIXED: CourseChecksResponse = CourseChecksResponseSchema.parse({
  courseResults: [
    {
      courseId: math102.id,
      prerequisite: buildCheckResult({
        state: CheckState.Conditional,
        reasonCode: ReasonCode.InProgressMinGrade,
        sourceRef: 'rule_demo_math101_to_math102',
        evidence: {
          rulesetVersion: 'demo-2026.1',
          decisiveLeaves: [
            {
              type: 'COURSE',
              path: [],
              courseId: math101.id,
              requiredGrade: { scheme: 'LETTER', value: 'C' },
              attemptIds: [],
              reasonCode: ReasonCode.InProgressMinGrade,
            },
          ],
        },
      }),
      applicability: buildCheckResult({ kind: CheckKind.RequirementApplicability }),
    },
    {
      courseId: ind390.id,
      prerequisite: null,
      applicability: buildCheckResult({
        kind: CheckKind.RequirementApplicability,
        state: CheckState.Unknown,
        reasonCode: ReasonCode.AuditStale,
      }),
    },
  ],
  setResults: {
    allocation: [buildCheckResult({ kind: CheckKind.RequirementAllocation })],
    creditLoad: buildCheckResult({
      kind: CheckKind.CreditLoad,
      state: CheckState.Unknown,
      reasonCode: ReasonCode.VariableCreditUnselected,
      evidence: {
        rulesetVersion: null,
        decisiveLeaves: [],
        courseIds: [ind390.id],
        creditLoad: null,
      },
    }),
  },
  aggregate: AggregateState.NeedsVerification,
  pinnedInputs: PINNED,
  courses: [
    {
      courseId: math102.id,
      code: 'DEMO-MATH 102',
      title: 'Demo Calculus II',
      credits: { kind: 'FIXED', creditsHundredths: 300 },
    },
    {
      courseId: ind390.id,
      code: 'DEMO-IND 390',
      title: null,
      credits: { kind: 'VARIABLE', minCreditsHundredths: 100, maxCreditsHundredths: 300 },
    },
  ],
});

/** A result where every check passed, from an API that sent no catalog entries. */
const ALL_PASSED: CourseChecksResponse = CourseChecksResponseSchema.parse({
  courseResults: [
    {
      courseId: math102.id,
      prerequisite: buildCheckResult({
        evidence: { rulesetVersion: 'demo-2026.1', decisiveLeaves: [] },
      }),
      applicability: buildCheckResult({ kind: CheckKind.RequirementApplicability }),
    },
  ],
  setResults: {
    allocation: [buildCheckResult({ kind: CheckKind.RequirementAllocation })],
    creditLoad: buildCheckResult({
      kind: CheckKind.CreditLoad,
      evidence: {
        rulesetVersion: 'demo-2026.1',
        decisiveLeaves: [],
        creditLoad: {
          totalCreditsHundredths: 1200,
          minCreditsHundredths: 1200,
          maxCreditsHundredths: 1800,
        },
      },
    }),
  },
  aggregate: AggregateState.Validated,
  pinnedInputs: PINNED,
});

/**
 * Renders the results with the response's own catalog entries.
 *
 * @param result - The response.
 * @returns The markup.
 */
function render(result: CourseChecksResponse): string {
  return renderToStaticMarkup(
    <CourseCheckResults result={result} courses={indexCourses(result.courses)} />,
  );
}

describe('CourseCheckResults', () => {
  it('shows each dimension under its own heading, per course and for the set', () => {
    const html = render(MIXED);

    expect(html.match(/<h4>Prerequisite<\/h4>/g)).toHaveLength(2);
    expect(html.match(/<h4>Requirement applicability<\/h4>/g)).toHaveLength(2);
    expect(html).toContain('<h4>Requirement allocation</h4>');
    expect(html).toContain('<h4>Credit load</h4>');
  });

  it('names each course by its catalog code, with the title when there is one', () => {
    const html = render(MIXED);

    expect(html).toContain(
      `<h3 id="result-course-${math102.id}">DEMO-MATH 102 (Demo Calculus II)</h3>`,
    );
    expect(html).toContain(`<h3 id="result-course-${ind390.id}">DEMO-IND 390</h3>`);
    expect(html).toContain('<dt>Courses involved</dt><dd><ul><li>DEMO-IND 390</li></ul></dd>');
  });

  it('names a course with no catalog entry by its ID and says so', () => {
    const html = render(ALL_PASSED);

    expect(html).toContain(
      `<h3 id="result-course-${math102.id}">Course <code>${math102.id}</code> (no catalog details available)</h3>`,
    );
  });

  it('explains a CONDITIONAL prerequisite with its next step and grade evidence', () => {
    const html = render(MIXED);

    expect(html).toContain('>Conditional</span>');
    expect(html).toContain('It is met only if you earn the required grade.');
    expect(html).toContain('<strong>Next step:</strong> Earn at least the grade shown');
    expect(html).toContain(
      `Requires C or higher in course ${math101.id} (no catalog details available)`,
    );
  });

  it('shows UNKNOWN as needing verification with a next step, never as passed', () => {
    const html = render(MIXED);

    expect(html.match(/>Needs verification<\/span>/g)).toHaveLength(3);
    expect(html).toContain('Ask your advisor which credit value to plan for that course.');
    expect(html).toContain('Treat these results as needing verification until the audit');
  });

  it('shows a missing prerequisite rule as not checked, never as passed', () => {
    const html = render(MIXED);

    expect(html).toContain('>No rule to check</span>');
    expect(html).toContain('This course has no prerequisite rule, so nothing was checked here.');
    expect(html.match(new RegExp(PASSED.replace(/[()]/g, '\\$&'), 'g'))).toHaveLength(2);
  });

  it('shows PASS as passed as of both pinned times', () => {
    const html = render(ALL_PASSED);

    expect(html.match(new RegExp(PASSED.replace(/[()]/g, '\\$&'), 'g'))).toHaveLength(4);
    expect(html).toContain('Total 12 credits; this term’s load is 12 to 18 credits.');
  });

  it('shows VALIDATED as limited to the listed checks, not as a green approval', () => {
    const html = render(ALL_PASSED);

    expect(html).toContain(
      'Overall: <span class="status-badge status-badge--neutral">Validated for the listed checks only</span>',
    );
    expect(html).toContain('It doesn’t register you, hold a seat, or check your schedule.');
  });

  it.each([
    ['a mixed result', MIXED],
    ['an all-passed result', ALL_PASSED],
  ])('never says approved or registered for %s', (_name, result) => {
    expect(render(result)).not.toMatch(/approved|registered/i);
  });
});
