/**
 * @file Schedule sections and fixed sentences shared by the chat cases (AC43, AC44): synthetic
 * sections of DEMO-MATH 102 and DEMO-PHYS 201, the intro and notice sentences copied literally
 * from the templates, and a reader for the options in a schedule block.
 * @module @caa/tests/support/chat-schedule-fixtures
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { MeetingLocationKind, Weekday } from '@caa/domain';
import {
  buildMeetingPattern,
  buildSection,
  buildTbaMeeting,
  SYNTHETIC_CAMPUSES,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

const { math102, phys201 } = SYNTHETIC_COURSES;

/** DEMO-MATH 102 section 071: MWF 09:00-09:50, so it meets on Friday. */
export const MATH_MWF = buildSection({ courseId: math102.id }, 71);

/** DEMO-MATH 102 section 072: TTh 09:00-09:50, so it never meets on Friday. */
export const MATH_TTH = buildSection(
  {
    courseId: math102.id,
    meetings: [buildMeetingPattern({ weekdays: [Weekday.Tuesday, Weekday.Thursday] })],
  },
  72,
);

/** DEMO-PHYS 201 section 053: MWF 09:00-09:50, so it conflicts with the MWF math section. */
export const PHYS_MWF = buildSection({ courseId: phys201.id }, 53);

/** DEMO-PHYS 201 section 054: TTh, with its meeting time removed, so a conflict is UNKNOWN. */
export const PHYS_TIME_REMOVED = buildSection(
  {
    courseId: phys201.id,
    meetings: [
      buildTbaMeeting({
        weekdays: [Weekday.Tuesday, Weekday.Thursday],
        location: {
          kind: MeetingLocationKind.OnCampus,
          campusId: SYNTHETIC_CAMPUSES.north.id,
          room: null,
        },
      }),
    ],
  },
  54,
);

/** The intro for a turn with no data blocks and no choice. */
export const ASK_FOR_DETAIL =
  'Could you tell me a little more about what you would like to plan or look up?';

/** The intro for a turn with a schedule options block. */
export const SCHEDULE_INTRO = 'Here are your schedule options. Each card shows its own checks.';

/** The intro for a turn with an academic summary block. */
export const ACADEMIC_SUMMARY_INTRO = 'Here is your academic summary, as shown on your record.';

/** The text of the stale-source notice. */
export const STALE_NOTICE =
  'The information for this answer is out of date and could not be confirmed, so nothing is shown as current. Use the planner and My plans for your saved work, and ask your advisor.';

/** The text of the source-unavailable notice. */
export const UNAVAILABLE_NOTICE =
  'The information for this answer could not be reached right now, so nothing is shown as current. Use the planner and My plans for your saved work, and ask your advisor.';

/** One option of a schedule block, with the checks the cases read. */
export interface OptionView {
  readonly rank: number;
  readonly aggregate: string;
  readonly scheduleFeasibility: { readonly state: string; readonly reasonCode?: string };
  readonly courseResults: readonly {
    readonly prerequisite: { readonly state: string; readonly reasonCode?: string };
  }[];
  readonly bundles: readonly { readonly sections: readonly { readonly sectionId: string }[] }[];
}

/**
 * Reads the options of the first schedule block of a turn.
 *
 * @param blocks - The turn's blocks.
 * @returns The options, or none when the turn has no schedule block.
 */
export function optionsOf(
  blocks: readonly { kind: string; [field: string]: unknown }[],
): readonly OptionView[] {
  const block = blocks.find((candidate) => candidate.kind === 'SCHEDULE_OPTIONS');
  return (block?.result as { options?: readonly OptionView[] } | undefined)?.options ?? [];
}

/**
 * Lists the section IDs of each option, sorted within and across options, so a case compares
 * them with a literal list.
 *
 * @param blocks - The turn's blocks.
 * @returns The sorted section IDs of each option.
 */
export function optionSections(
  blocks: readonly { kind: string; [field: string]: unknown }[],
): string[][] {
  return optionsOf(blocks)
    .map((option) =>
      option.bundles
        .flatMap((bundle) => bundle.sections.map((section) => section.sectionId))
        .sort(),
    )
    .sort();
}
