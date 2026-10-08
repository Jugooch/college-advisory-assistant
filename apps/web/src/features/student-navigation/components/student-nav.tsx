/**
 * @file Navigation between one student's screens, marking the current page.
 * @module @caa/web/features/student-navigation/components/student-nav
 * @requirement NFR-02
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

/** The student screens. */
export type StudentScreen = 'overview' | 'course-checks' | 'next-term-planner' | 'my-plans';

/** Props for {@link StudentNav}. */
export interface StudentNavProps {
  /** Internal student ID, carried in each link's query. */
  readonly studentId: string;
  /** The screen being shown, marked with `aria-current`. */
  readonly current: StudentScreen;
}

/** Each screen's path and link text, in navigation order. */
const SCREENS: readonly {
  readonly screen: StudentScreen;
  readonly path: string;
  readonly label: string;
}[] = [
  { screen: 'overview', path: '/overview', label: 'Overview' },
  { screen: 'course-checks', path: '/course-checks', label: 'Course checks' },
  { screen: 'next-term-planner', path: '/next-term-planner', label: 'Plan next term' },
  { screen: 'my-plans', path: '/my-plans', label: 'My plans' },
];

/**
 * Renders the student navigation landmark.
 *
 * @param props - The student ID and the current screen.
 * @returns The nav element.
 */
export function StudentNav({ studentId, current }: StudentNavProps): ReactElement {
  const query = new URLSearchParams({ studentId }).toString();
  return (
    <nav aria-label="Student">
      <ul className="nav-list">
        {SCREENS.map(({ screen, path, label }) => (
          <li key={screen}>
            <Link href={`${path}?${query}`} aria-current={screen === current ? 'page' : undefined}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
