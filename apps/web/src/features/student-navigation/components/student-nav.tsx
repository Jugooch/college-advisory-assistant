/**
 * @file Navigation between one student's screens, marking the current page.
 * @module @caa/web/features/student-navigation/components/student-nav
 * @requirement NFR-02
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

import {
  STUDENT_SCREENS,
  type StudentScreen,
  studentScreenHref,
} from '@/shared/utils/student-screens';

/** Props for {@link StudentNav}. */
export interface StudentNavProps {
  /** Internal student ID, carried in each link's query. */
  readonly studentId: string;
  /** The screen being shown, marked with `aria-current`; `null` on a screen the nav doesn't list. */
  readonly current: StudentScreen | null;
}

/**
 * Renders the student navigation landmark.
 *
 * @param props - The student ID and the current screen.
 * @returns The nav element.
 */
export function StudentNav({ studentId, current }: StudentNavProps): ReactElement {
  return (
    <nav aria-label="Student">
      <ul className="nav-list">
        {STUDENT_SCREENS.map(({ screen, label }) => (
          <li key={screen}>
            <Link
              href={studentScreenHref(screen, studentId)}
              aria-current={screen === current ? 'page' : undefined}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
