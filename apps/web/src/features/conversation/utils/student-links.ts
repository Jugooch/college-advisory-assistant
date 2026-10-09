/**
 * @file Links from the chat panel to the screens that show verified results.
 * @module @caa/web/features/conversation/utils/student-links
 * @requirement FR-10
 */
import { studentScreenHref } from '@/shared/utils/student-screens';

/** The screens a chat block can point to. */
export interface StudentLinks {
  readonly planner: string;
  readonly plans: string;
  readonly overview: string;
  readonly help: string;
}

/**
 * Builds the links for a student from the same routes the student navigation uses.
 *
 * @param studentId - Internal student ID from the page URL.
 * @returns One link per screen.
 */
export function studentLinks(studentId: string): StudentLinks {
  return {
    planner: studentScreenHref('next-term-planner', studentId),
    plans: studentScreenHref('my-plans', studentId),
    overview: studentScreenHref('overview', studentId),
    help: studentScreenHref('help-and-cases', studentId),
  };
}
