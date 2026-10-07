/**
 * @file Shows the pinned record and the audit it is compared with: program, catalog, and times.
 * @module @caa/web/features/academic-summary/components/record-details
 * @requirement FR-02
 * @requirement FR-04
 */
import type { ReactElement } from 'react';

import type { AcademicSummaryResponse } from '@caa/api-contract';

import { Timestamp } from '@/shared/components/timestamp';

/** Props for {@link RecordDetails}. */
export interface RecordDetailsProps {
  readonly summary: AcademicSummaryResponse;
}

const NOT_STATED = 'Not stated in your record';

/** Props for {@link ProgramName}. */
interface ProgramNameProps {
  readonly programId: string;
  /** The catalog name, or null or absent when the API didn't supply one. */
  readonly programName: string | null | undefined;
}

/**
 * Names a program by its catalog name, or by its ID and a note when no name was supplied.
 *
 * @param props - The program ID and its name.
 * @returns The name, or the ID as code.
 */
function ProgramName({ programId, programName }: ProgramNameProps): ReactElement {
  return programName === null || programName === undefined ? (
    <>
      <code>{programId}</code> (name not available)
    </>
  ) : (
    <>{programName}</>
  );
}

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
        <dd>
          {record.programId === null ? (
            NOT_STATED
          ) : (
            <ProgramName programId={record.programId} programName={record.programName} />
          )}
        </dd>
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
              <ProgramName programId={audit.programId} programName={audit.programName} />, catalog{' '}
              {audit.catalogYear}
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}
