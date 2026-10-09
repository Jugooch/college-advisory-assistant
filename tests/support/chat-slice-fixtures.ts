/**
 * @file Fixtures for the AC47 chat slice: a Friday-free pair of DEMO-MATH 102 sections beside a
 * Friday one, a DEMO-PHYS 201 section that fits both, and the confirmed no-Fridays rule.
 * @module @caa/tests/support/chat-slice-fixtures
 * @see docs/planning/14-first-vertical-slice.md
 * @see docs/standards/07-testing.md
 */
import { Weekday } from '@caa/domain';
import { buildMeetingPattern, buildSection, SYNTHETIC_COURSES } from '@caa/test-kit';

const { math102, phys201 } = SYNTHETIC_COURSES;

/** DEMO-MATH 102 on Mon, Wed and Fri 09:00: the only section a no-Fridays rule must exclude. */
export const MATH_FRIDAY = buildSection({ courseId: math102.id }, 71);
/** DEMO-MATH 102 on Tue and Thu 09:00. */
export const MATH_TTH_AM = buildSection(
  {
    courseId: math102.id,
    meetings: [buildMeetingPattern({ weekdays: [Weekday.Tuesday, Weekday.Thursday] })],
  },
  72,
);
/** DEMO-MATH 102 on Tue and Thu 11:00. */
export const MATH_TTH_LATE = buildSection(
  {
    courseId: math102.id,
    meetings: [
      buildMeetingPattern({
        weekdays: [Weekday.Tuesday, Weekday.Thursday],
        startTime: '11:00',
        endTime: '11:50',
      }),
    ],
  },
  73,
);
/** DEMO-PHYS 201 on Mon and Wed 09:00, compatible with both Tuesday and Thursday sections. */
export const PHYS_MW = buildSection(
  {
    courseId: phys201.id,
    meetings: [buildMeetingPattern({ weekdays: [Weekday.Monday, Weekday.Wednesday] })],
  },
  74,
);

/** The no-Fridays rule as the planner form holds it once the student confirms it as hard. */
export const HARD_NO_FRIDAYS = {
  kind: 'UNAVAILABLE_TIME',
  strength: 'HARD',
  priorityRank: null,
  weekdays: ['FRIDAY'],
  startTime: '00:00',
  endTime: '24:00',
} as const;
