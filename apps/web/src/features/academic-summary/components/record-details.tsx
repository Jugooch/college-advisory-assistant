/**
 * @file Shows the pinned record and the audit it is compared with: program, catalog, and times.
 * @module @caa/web/features/academic-summary/components/record-details
 * @requirement FR-02
 * @requirement FR-04
 */
import type { ReactElement } from 'react';

import type { AcademicSummaryResponse } from '@caa/api-contract';

import { Timestamp } from '@/features/verification-states/components/timestamp';

/** Props for {@link RecordDetails}. */
export interface RecordDetailsProps {
  readonly summary: AcademicSummaryResponse;
}

const NOT_STATED = 'Not stated in your record';

/**
 * Renders the record and audit facts as a description list.
 *
 * @param props - The academic summary.
 * @returns The record section.
 */
export function RecordDetails({ summary }: RecordDetailsProps): ReactElement {
  const { studentSnapshot: record, audit } = summary;
  return (
    <section aria-labelledby="record-heading">
      <h2 id="record-heading">Your record</h2>
      <dl className="facts">
        <dt>Student reference</dt>
        <dd>
          <code>{summary.student.sourceStudentId}</code>
        </dd>
        <dt>Program in your record</dt>
        <dd>{record.programId === null ? NOT_STATED : <code>{record.programId}</code>}</dd>
        <dt>Catalog in your record</dt>
        <dd>{record.catalogYear ?? NOT_STATED}</dd>
        <dt>Record data as of</dt>
        <dd>
          <Timestamp iso={record.sourceEffectiveAt} />
        </dd>
        {audit === null ? null : (
          <>
            <dt>Degree audit</dt>
            <dd>
              <code>
                {audit.auditSource} {audit.auditVersion}
              </code>
              , generated <Timestamp iso={audit.generatedAt} />
            </dd>
            <dt>Program and catalog in the audit</dt>
            <dd>
              <code>{audit.programId}</code>, catalog {audit.catalogYear}
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}
