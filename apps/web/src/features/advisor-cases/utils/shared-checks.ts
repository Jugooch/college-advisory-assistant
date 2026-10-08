/**
 * @file Lists the checks that did not pass on a saved revision, for the "what will be shared"
 * preview. They are read from the stored result exactly as the API returned it; no state is
 * recomputed, upgraded, or filled in.
 * @module @caa/web/features/advisor-cases/utils/shared-checks
 * @requirement FR-12
 * @requirement NFR-02
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { PlanRevisionView, ScheduleOption } from '@caa/api-contract';
import { type CheckKind, type CheckResult, CheckState, type ReasonCode } from '@caa/domain';

/** One check that did not pass, with the course it concerns when it has one. */
export interface SharedCheck {
  /** Stable within one list, for React keys. */
  readonly key: string;
  readonly kind: CheckKind;
  /** The course the check is about; `null` for a check on the whole schedule. */
  readonly courseId: string | null;
  readonly state: CheckState;
  readonly reasonCode: ReasonCode | null;
}

/** What the preview can say about a revision's checks. */
export type SharedChecks =
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'listed'; readonly checks: readonly SharedCheck[] };

const KIND_LABELS: Readonly<Record<CheckKind, string>> = {
  REQUIREMENT_APPLICABILITY: 'Requirement applicability',
  REQUIREMENT_ALLOCATION: 'Requirement allocation',
  PREREQUISITE: 'Prerequisite',
  COREQUISITE: 'Corequisite',
  SCHEDULE_FEASIBILITY: 'Schedule',
  OFFERING_STATUS: 'Offering',
  SEAT_ELIGIBILITY: 'Seat eligibility',
  CREDIT_LOAD: 'Credit load',
  REGISTRATION_READINESS: 'Registration readiness',
};

/**
 * Names a check dimension.
 *
 * @param kind - The check kind from the API.
 * @returns A short label, for example `Prerequisite`.
 */
export function describeCheckKind(kind: CheckKind): string {
  return KIND_LABELS[kind];
}

/**
 * Returns whether an option is the one the revision saved.
 *
 * @param option - A schedule option from the stored result.
 * @param selected - The revision's chosen section IDs, sorted.
 * @returns `true` when the option's distinct section IDs are exactly the chosen ones.
 */
function isSavedOption(option: ScheduleOption, selected: readonly string[]): boolean {
  const ids = [
    ...new Set(option.bundles.flatMap((bundle) => bundle.sections.map((s) => s.sectionId))),
  ].sort();
  return ids.join(',') === selected.join(',');
}

/**
 * Lists the checks of one option that did not pass.
 *
 * @param option - The saved option.
 * @returns The non-passing checks in display order.
 */
function listOptionChecks(option: ScheduleOption): readonly SharedCheck[] {
  const entries: { readonly courseId: string | null; readonly check: CheckResult | null }[] = [
    { courseId: null, check: option.scheduleFeasibility },
    ...[...option.courseResults, ...option.linkedCourseResults].flatMap((result) => [
      { courseId: result.courseId, check: result.prerequisite },
      { courseId: result.courseId, check: result.applicability },
    ]),
    ...option.setResults.allocation.map((check) => ({ courseId: null, check })),
    { courseId: null, check: option.setResults.creditLoad },
  ];
  return toSharedChecks(entries);
}

/**
 * Keeps the entries whose check did not pass.
 *
 * @param entries - Checks with their course, in display order. A `null` check means no rule.
 * @returns The non-passing checks.
 */
function toSharedChecks(
  entries: readonly { readonly courseId: string | null; readonly check: CheckResult | null }[],
): readonly SharedCheck[] {
  return entries.flatMap(({ courseId, check }, index) =>
    check === null || check.state === CheckState.Pass
      ? []
      : [
          {
            key: `${String(index)}-${check.kind}-${courseId ?? 'set'}`,
            kind: check.kind,
            courseId,
            state: check.state,
            reasonCode: check.reasonCode ?? null,
          },
        ],
  );
}

/**
 * Lists the checks that did not pass on a revision.
 *
 * @param revision - The revision as the API returned it.
 * @returns `unavailable` when its stored result can't be read, so the preview never guesses;
 *   otherwise the saved option's non-passing checks, or the unresolved schedule checks when the
 *   revision saved no option.
 */
export function listSharedChecks(revision: PlanRevisionView): SharedChecks {
  const { result, selectedSectionIds } = revision;
  if (result === null) {
    return { kind: 'unavailable' };
  }
  if (selectedSectionIds === null) {
    return {
      kind: 'listed',
      checks: toSharedChecks(result.unresolved.map((check) => ({ courseId: null, check }))),
    };
  }
  const saved = result.options.find((option) => isSavedOption(option, selectedSectionIds));
  // SAFETY: if the saved option can't be found, say so; an empty list would read as "all passed".
  return saved === undefined
    ? { kind: 'unavailable' }
    : { kind: 'listed', checks: listOptionChecks(saved) };
}
