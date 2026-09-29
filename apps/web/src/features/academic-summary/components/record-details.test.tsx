/**
 * @file Tests that the record names its program by catalog name when the API supplies one, and
 * otherwise by the ID it showed before.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { type AcademicSummaryResponse, AcademicSummaryResponseSchema } from '@caa/api-contract';
import { CheckState } from '@caa/domain';
import { buildRequirementResult, syntheticId } from '@caa/test-kit';

import { RecordDetails } from './record-details';

const PROGRAM_ID = syntheticId('program', 1);

/**
 * Builds a contract-valid summary with one program in the record and the audit.
 *
 * @param names - The program names, or an empty object to omit them.
 * @returns The parsed summary.
 */
function summaryWith(names: {
  readonly record?: string | null;
  readonly audit?: string | null;
}): AcademicSummaryResponse {
  return AcademicSummaryResponseSchema.parse({
    student: { id: syntheticId('student', 3), sourceStudentId: 'SYN-000003' },
    studentSnapshot: {
      id: syntheticId('studentSnapshot', 3),
      programId: PROGRAM_ID,
      catalogYear: '2025-2026',
      sourceEffectiveAt: '2026-09-12T14:00:00Z',
      ...(names.record === undefined ? {} : { programName: names.record }),
    },
    audit: {
      auditSource: 'demo-audit',
      auditVersion: 'audit_demo_r9',
      programId: PROGRAM_ID,
      catalogYear: '2025-2026',
      generatedAt: '2026-09-10T09:00:00Z',
      ...(names.audit === undefined ? {} : { programName: names.audit }),
    },
    auditReflectsRecord: { state: CheckState.Pass, reasonCode: null },
    programCatalogConsistency: { state: CheckState.Pass, reasonCode: null },
    requirements: [buildRequirementResult({ label: 'Core' })],
  });
}

describe('RecordDetails', () => {
  it('shows the program name in the record and the audit when supplied', () => {
    const html = renderToStaticMarkup(
      <RecordDetails summary={summaryWith({ record: 'Demo BS Mathematics', audit: 'Demo BS' })} />,
    );

    expect(html).toContain('<dt>Program in your record</dt><dd>Demo BS Mathematics</dd>');
    expect(html).toContain('<dd>Demo BS, catalog 2025-2026</dd>');
    expect(html).not.toContain(`<code>${PROGRAM_ID}</code>`);
  });

  it.each([
    ['null', { record: null, audit: null }],
    ['omitted', {}],
  ])('shows the program ID when the name is %s', (_name, names) => {
    const html = renderToStaticMarkup(<RecordDetails summary={summaryWith(names)} />);

    expect(html).toContain(`<dt>Program in your record</dt><dd><code>${PROGRAM_ID}</code></dd>`);
    expect(html).toContain(`<dd><code>${PROGRAM_ID}</code>, catalog 2025-2026</dd>`);
  });
});
