/**
 * @file Tests that the requirement tree shows states in words, as of the audit time, and never
 * as current standing when the audit needs verification.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { type AcademicSummaryResponse, AcademicSummaryResponseSchema } from '@caa/api-contract';
import { CheckState, ReasonCode, RequirementState } from '@caa/domain';
import { buildRequirementResult, SYNTHETIC_COURSES, syntheticId } from '@caa/test-kit';

import { RequirementOverview } from './requirement-overview';

const PROGRAM_ID = syntheticId('program', 1);
const { math101, math102 } = SYNTHETIC_COURSES;

/**
 * Builds a contract-valid summary with a two-level requirement tree.
 *
 * @param auditReflectsRecord - The audit reflects-record verdict.
 * @returns The parsed summary.
 */
function treeSummary(
  auditReflectsRecord: AcademicSummaryResponse['auditReflectsRecord'],
): AcademicSummaryResponse {
  return AcademicSummaryResponseSchema.parse({
    student: { id: syntheticId('student', 2), sourceStudentId: 'SYN-000002' },
    studentSnapshot: {
      id: syntheticId('studentSnapshot', 2),
      programId: PROGRAM_ID,
      catalogYear: '2025-2026',
      sourceEffectiveAt: '2026-09-12T14:00:00Z',
      programName: null,
    },
    audit: {
      auditSource: 'demo-audit',
      auditVersion: 'audit_demo_r8',
      programId: PROGRAM_ID,
      catalogYear: '2025-2026',
      programName: null,
      generatedAt: '2026-09-10T09:00:00Z',
      studentRecordEffectiveAt: '2026-09-10T08:00:00Z',
    },
    auditReflectsRecord,
    programCatalogConsistency: { state: CheckState.Pass, reasonCode: null },
    requirements: [
      buildRequirementResult({ label: 'Core', state: RequirementState.InProgress }, 1),
      buildRequirementResult(
        {
          label: 'Calculus I',
          parentSourceRequirementId: 'REQ-001',
          state: RequirementState.Complete,
          remainingCreditsHundredths: 0,
          remainingCourseCount: 0,
          candidateCourseIds: [math101.id, math102.id],
        },
        2,
      ),
      buildRequirementResult(
        { label: 'Calculus II', parentSourceRequirementId: 'REQ-001', candidateCourseIds: [] },
        3,
      ),
    ],
    courses: [
      {
        courseId: math101.id,
        code: 'DEMO-MATH 101',
        title: 'Demo Calculus I',
        credits: { kind: 'FIXED', creditsHundredths: 300 },
      },
    ],
  });
}

describe('RequirementOverview', () => {
  it('shows each state in words as of the audit time', () => {
    const summary = treeSummary({ state: CheckState.Pass, reasonCode: null });

    const html = renderToStaticMarkup(<RequirementOverview summary={summary} />);

    expect(html).toContain('>Complete as of Sep 10, 2026, 9:00 AM UTC</span>');
    expect(html).toContain('>In progress as of Sep 10, 2026, 9:00 AM UTC</span>');
    expect(html).toContain('>Not complete as of Sep 10, 2026, 9:00 AM UTC</span>');
  });

  it('nests child requirements in a list inside their parent', () => {
    const summary = treeSummary({ state: CheckState.Pass, reasonCode: null });

    const html = renderToStaticMarkup(<RequirementOverview summary={summary} />);

    expect(html).toMatch(
      /Core<\/span>.*<ul><li class="requirement"><span class="requirement__label">Calculus I</,
    );
  });

  it('puts the evidence one interaction away, in a details element', () => {
    const summary = treeSummary({ state: CheckState.Pass, reasonCode: null });

    const html = renderToStaticMarkup(<RequirementOverview summary={summary} />);

    expect(html).toContain('<summary>Evidence for Calculus I</summary>');
    expect(html).toContain('<code>demo-audit/REQ-002</code>');
  });

  it('lists the courses the audit names by catalog code, or by ID when there is no entry', () => {
    const summary = treeSummary({ state: CheckState.Pass, reasonCode: null });

    const html = renderToStaticMarkup(<RequirementOverview summary={summary} />);

    expect(html).toContain(
      '<dt>Courses the audit lists for it</dt><dd><ul><li>DEMO-MATH 101 (Demo Calculus I)</li>' +
        `<li>Course <code>${math102.id}</code> (no catalog details available)</li></ul></dd>`,
    );
    expect(html).toContain('<dt>Courses the audit lists for it</dt><dd>None</dd>');
  });

  it('shows every state as needing verification when the audit is stale', () => {
    const summary = treeSummary({ state: CheckState.Unknown, reasonCode: ReasonCode.AuditStale });

    const html = renderToStaticMarkup(<RequirementOverview summary={summary} />);

    expect(html).toContain('Needs verification: audit showed complete as of Sep 10, 2026');
    expect(html).toContain('Needs verification: audit showed in progress as of Sep 10, 2026');
    expect(html).not.toMatch(/>(Complete|In progress|Not complete) as of/);
  });

  it('offers the requirements as a table with row and column headers', () => {
    const summary = treeSummary({ state: CheckState.Pass, reasonCode: null });

    const html = renderToStaticMarkup(<RequirementOverview summary={summary} />);

    expect(html).toContain('<summary>Show requirements as a table</summary>');
    expect(html).toContain('<th scope="col">Part of</th>');
    expect(html).toContain('<th scope="row">Calculus II</th><td>Core</td>');
  });
});
