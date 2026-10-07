/**
 * @file Pure rules for saving a plan draft by replay: comparing pinned inputs, checking the chosen
 * sections against the replayed options, and building the revision to store.
 * @module @caa/api/modules/plan-drafts/plan-drafts.logic
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-01
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type {
  ScheduleOptionsRequest,
  ScheduleOptionsResponse,
  SchedulePinnedInputs,
} from '@caa/api-contract';
import type { NewPlanRevision } from '@caa/db';
import {
  type AuditSnapshot,
  type AuditSnapshotId,
  type PlanRevisionCause,
  ScheduleOutcome,
  type SectionId,
  type UserId,
} from '@caa/domain';

/** The keys of the pinned inputs, compared one by one. */
const PINNED_KEYS = [
  'studentSnapshotId',
  'studentRecordEffectiveAt',
  'auditRecordEffectiveAt',
  'auditSource',
  'auditVersion',
  'rulesetVersion',
  'sectionSnapshotId',
  'campusTransitionVersion',
  'solverWorkCap',
  'constraintHash',
] as const satisfies readonly (keyof SchedulePinnedInputs)[];

/**
 * Compares two instants as instants, so `Z` and an offset spelling of one moment are equal.
 *
 * @param left - ISO 8601 time.
 * @param right - ISO 8601 time.
 * @returns True when both parse and are the same moment.
 */
function isSameInstant(left: string, right: string): boolean {
  const leftMs = Date.parse(left);
  return !Number.isNaN(leftMs) && leftMs === Date.parse(right);
}

/**
 * Checks that the replay ran on exactly the inputs the client was shown.
 *
 * @param replayed - The pinned inputs of the server's replay.
 * @param expected - The pinned inputs the client states it saw.
 * @returns True when every pinned input is equal.
 */
export function pinnedInputsMatch(
  replayed: SchedulePinnedInputs,
  expected: SchedulePinnedInputs,
): boolean {
  return PINNED_KEYS.every((key) =>
    key === 'studentRecordEffectiveAt' || key === 'auditRecordEffectiveAt'
      ? isSameInstant(replayed[key], expected[key])
      : replayed[key] === expected[key],
  );
}

/**
 * Checks that the latest audit is the one the replay pinned.
 *
 * @param audit - The latest audit.
 * @param pinned - The replay's pinned inputs.
 * @returns True when source, version, and record time all agree.
 */
export function auditMatchesPins(audit: AuditSnapshot, pinned: SchedulePinnedInputs): boolean {
  return (
    audit.auditSource === pinned.auditSource &&
    audit.auditVersion === pinned.auditVersion &&
    isSameInstant(audit.studentRecordEffectiveAt, pinned.auditRecordEffectiveAt)
  );
}

/**
 * Lists the sections of each replayed option as a sorted ID list.
 *
 * @param result - The replayed options.
 * @returns One sorted list per option.
 */
function optionSectionSets(result: ScheduleOptionsResponse): string[][] {
  return result.options.map((option) =>
    option.bundles.flatMap((bundle) => bundle.sections.map((section) => section.sectionId)).sort(),
  );
}

/**
 * Checks the chosen sections against the replay and returns them in stored order.
 *
 * @param result - The replayed result.
 * @param requested - The sections the client chose, or null for none.
 * @returns The sorted selection (null when none), or `INVALID` when the choice isn't one of the
 *   replayed options, or isn't null when the outcome has no options.
 */
export function resolveSelection(
  result: ScheduleOptionsResponse,
  requested: readonly SectionId[] | null,
): readonly SectionId[] | null | 'INVALID' {
  // SAFETY: a schedule the engine did not produce is never stored as the plan (ADR-0013 §2).
  if (result.outcome !== ScheduleOutcome.OptionsFound) {
    return requested === null ? null : 'INVALID';
  }
  if (requested === null) {
    return 'INVALID';
  }
  const sorted = requested.toSorted();
  const key = sorted.join(',');
  return optionSectionSets(result).some((set) => set.join(',') === key) ? sorted : 'INVALID';
}

/** What a stored revision is built from. */
export interface RevisionSource {
  readonly request: ScheduleOptionsRequest;
  /** The server's replay; never a client-supplied result. */
  readonly result: ScheduleOptionsResponse;
  readonly selectedSectionIds: readonly SectionId[] | null;
  readonly auditSnapshotId: AuditSnapshotId;
  readonly cause: PlanRevisionCause;
  readonly createdBy: UserId;
  /** ISO 8601 time from the injected clock. */
  readonly createdAt: string;
}

/**
 * Builds the revision to store from the replay.
 *
 * @param source - The request, the replayed result, the selection, and who saved when.
 * @returns The revision without its ID, plan, or number, which the repository assigns.
 */
export function buildNewRevision(source: RevisionSource): NewPlanRevision {
  const { request, result } = source;
  const pins = result.pinnedInputs;
  return {
    cause: source.cause,
    createdBy: source.createdBy,
    createdAt: source.createdAt,
    termId: request.termId,
    courseIds: result.courseIds,
    creditSelections: request.creditSelections,
    constraints: request.constraints,
    studentSnapshotId: pins.studentSnapshotId,
    studentRecordEffectiveAt: pins.studentRecordEffectiveAt,
    auditRecordEffectiveAt: pins.auditRecordEffectiveAt,
    auditSnapshotId: source.auditSnapshotId,
    auditSource: pins.auditSource,
    auditVersion: pins.auditVersion,
    rulesetVersion: pins.rulesetVersion,
    sectionSnapshotId: pins.sectionSnapshotId,
    campusTransitionVersion: pins.campusTransitionVersion,
    solverWorkCap: pins.solverWorkCap,
    constraintHash: pins.constraintHash,
    outcome: result.outcome,
    selectedSectionIds: source.selectedSectionIds,
    result,
  };
}
