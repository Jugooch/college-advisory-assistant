/**
 * @file Links from the chat panel to the screens that show verified results.
 * @module @caa/web/features/conversation/utils/student-links
 * @requirement FR-10
 */

/** The screens a chat block can point to. */
export interface StudentLinks {
  readonly planner: string;
  readonly plans: string;
  readonly overview: string;
  readonly help: string;
}

/**
 * Builds the links for a student.
 *
 * @param studentId - Internal student ID from the page URL.
 * @returns One link per screen.
 */
export function studentLinks(studentId: string): StudentLinks {
  const query = new URLSearchParams({ studentId }).toString();
  return {
    planner: `/next-term-planner?${query}`,
    plans: `/my-plans?${query}`,
    overview: `/overview?${query}`,
    help: `/help-and-cases?${query}`,
  };
}
