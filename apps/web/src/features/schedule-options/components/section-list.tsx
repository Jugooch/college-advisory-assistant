/**
 * @file The courses and sections of one option, with every meeting as text.
 * @module @caa/web/features/schedule-options/components/section-list
 * @requirement FR-09
 * @requirement NFR-02
 */
import type { ReactElement } from 'react';

import type { ScheduleOption } from '@caa/api-contract';

import { CourseLabel } from '@/shared/components/course-label';
import type { CourseLookup } from '@/shared/utils/course-display';
import { formatCredits } from '@/shared/utils/format-display';
import { describeModality } from '@/shared/utils/section-wording';

import { describeDateRange, describeMeeting } from '../utils/meeting-wording';

/** Props for {@link SectionList}. */
export interface SectionListProps {
  readonly bundles: ScheduleOption['bundles'];
  readonly courses: CourseLookup;
}

/**
 * Lists each requested course with its sections, meetings, dates, and credits counted.
 *
 * @param props - The option's bundles and the course names.
 * @returns A list, one item per course.
 */
export function SectionList({ bundles, courses }: SectionListProps): ReactElement {
  return (
    <ul className="section-list">
      {bundles.map((bundle) => (
        <li key={bundle.courseId}>
          <strong>
            <CourseLabel courseId={bundle.courseId} courses={courses} />
          </strong>
          <p>
            Credits counted:{' '}
            {bundle.creditsCountedHundredths === null
              ? 'not determined'
              : formatCredits(bundle.creditsCountedHundredths)}
          </p>
          <ul>
            {bundle.sections.map((section) => (
              <li key={section.sectionId}>
                <span>
                  Section {section.sectionCode}
                  {section.courseId === bundle.courseId ? null : (
                    <>
                      {' '}
                      (linked section of{' '}
                      <CourseLabel courseId={section.courseId} courses={courses} />)
                    </>
                  )}
                  : {describeModality(section.modality)}, runs{' '}
                  {describeDateRange(section.startsOn, section.endsOn)}.
                </span>
                {section.meetings.length === 0 ? (
                  <p>No meeting times.</p>
                ) : (
                  <ul>
                    {section.meetings.map((meeting, index) => (
                      <li key={`${String(index)}-${meeting.startsOn}`}>
                        Meeting {index + 1}: {describeMeeting(meeting)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
