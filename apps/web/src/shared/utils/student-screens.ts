/**
 * @file The student screens: their paths and link text, and the link to one for a student.
 * @module @caa/web/shared/utils/student-screens
 * @requirement NFR-02
 */

/** The student screens. */
export type StudentScreen =
  'overview' | 'course-checks' | 'next-term-planner' | 'my-plans' | 'help-and-cases';

/** One screen's path and link text. */
export interface StudentScreenEntry {
  readonly screen: StudentScreen;
  readonly path: string;
  readonly label: string;
}

/** Each screen's path and link text, in navigation order. */
export const STUDENT_SCREENS: readonly StudentScreenEntry[] = [
  { screen: 'overview', path: '/overview', label: 'Overview' },
  { screen: 'course-checks', path: '/course-checks', label: 'Course checks' },
  { screen: 'next-term-planner', path: '/next-term-planner', label: 'Plan next term' },
  { screen: 'my-plans', path: '/my-plans', label: 'My plans' },
  { screen: 'help-and-cases', path: '/help-and-cases', label: 'Help and cases' },
];

/**
 * Builds the link to a student screen.
 *
 * @param screen - The screen to open.
 * @param studentId - Internal student ID, carried in the query.
 * @returns The path with the student's query.
 */
export function studentScreenHref(screen: StudentScreen, studentId: string): string {
  const entry = STUDENT_SCREENS.find((candidate) => candidate.screen === screen);
  const query = new URLSearchParams({ studentId }).toString();
  return `${entry?.path ?? '/'}?${query}`;
}
