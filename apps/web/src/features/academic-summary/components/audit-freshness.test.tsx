/**
 * @file Tests that audit freshness is stated plainly and never shown as current when unknown.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { type AcademicSummaryResponse, AcademicSummaryResponseSchema } from '@caa/api-contract';
import { CheckState, ReasonCode } from '@caa/domain';
import { buildRequirementResult, syntheticId } from '@caa/test-kit';

import { AuditFreshness } from './audit-freshness';

const PROGRAM_ID = syntheticId('program', 1);

/**
 * Builds a contract-valid summary for one synthetic student with an audit.
 *
 * @param verdicts - The two freshness verdicts; the program fields follow the consistency one.
 * @returns The parsed summary.
 */
function summaryWith(verdicts: {
  readonly auditReflectsRecord: AcademicSummaryResponse['auditReflectsRecord'];
  readonly isProgramMatched: boolean;
}): AcademicSummaryResponse {
  return AcademicSummaryResponseSchema.parse({
    student: { id: syntheticId('student', 1), sourceStudentId: 'SYN-000001' },
    studentSnapshot: {
      id: syntheticId('studentSnapshot', 1),
      programId: verdicts.isProgramMatched ? PROGRAM_ID : syntheticId('program', 2),
      catalogYear: '2025-2026',
      sourceEffectiveAt: '2026-09-12T14:00:00Z',
      programName: null,
    },
    audit: {
      auditSource: 'demo-audit',
      auditVersion: 'audit_demo_r7',
      programId: PROGRAM_ID,
      catalogYear: '2025-2026',
      programName: null,
      generatedAt: '2026-09-10T09:00:00Z',
      studentRecordEffectiveAt: '2026-09-10T08:00:00Z',
    },
    auditReflectsRecord: verdicts.auditReflectsRecord,
    programCatalogConsistency: verdicts.isProgramMatched
      ? { state: CheckState.Pass, reasonCode: null }
      : { state: CheckState.Unknown, reasonCode: ReasonCode.AuditProgramMismatch },
    courses: [],
    requirements: [buildRequirementResult()],
  });
}

describe('AuditFreshness', () => {
  it('shows both passing verdicts as passed as of the record time', () => {
    const summary = summaryWith({
      auditReflectsRecord: { state: CheckState.Pass, reasonCode: null },
      isProgramMatched: true,
    });

    const html = renderToStaticMarkup(<AuditFreshness summary={summary} />);

    expect(html.match(/Passed as of Sep 12, 2026, 2:00 PM UTC/g)).toHaveLength(2);
    expect(html).not.toContain('Needs verification');
  });

  it('shows a stale audit as needing verification with its explanation and next step', () => {
    const summary = summaryWith({
      auditReflectsRecord: { state: CheckState.Unknown, reasonCode: ReasonCode.AuditStale },
      isProgramMatched: true,
    });

    const html = renderToStaticMarkup(<AuditFreshness summary={summary} />);

    expect(html).toContain('Degree audit needs verification</h2>');
    expect(html).toContain('>Needs verification</span>');
    expect(html).toContain('Your degree audit is older than your latest record');
    expect(html).toContain(
      '<strong>Next step:</strong> Treat these results as needing verification',
    );
  });

  it('shows a program or catalog mismatch as needing verification', () => {
    const summary = summaryWith({
      auditReflectsRecord: { state: CheckState.Pass, reasonCode: null },
      isProgramMatched: false,
    });

    const html = renderToStaticMarkup(<AuditFreshness summary={summary} />);

    expect(html).toContain('Degree audit needs verification</h2>');
    expect(html).toContain('for a different program or catalog than your record shows');
  });

  it('says plainly when there is no audit, with a next step', () => {
    const summary = AcademicSummaryResponseSchema.parse({
      ...summaryWith({
        auditReflectsRecord: { state: CheckState.Pass, reasonCode: null },
        isProgramMatched: true,
      }),
      audit: null,
      auditReflectsRecord: null,
      programCatalogConsistency: null,
      requirements: [],
    });

    const html = renderToStaticMarkup(<AuditFreshness summary={summary} />);

    expect(html).toContain('No degree audit on file');
    expect(html).toContain('Ask your advisor to run a degree audit for you.');
    expect(html).not.toContain('Passed');
  });
});
