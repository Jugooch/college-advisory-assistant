/**
 * @file Builds synthetic schedule-options responses in the #258 contract shape, with the
 *   synthetic pinned inputs every response carries. The builder parses its result with the
 *   contract schema, so an outcome whose evidence doesn't fit it (ADR-0010 §5) fails where it
 *   is built.
 * @module @caa/test-kit/builders/schedule-options-response
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import type { z } from 'zod';

import {
  namedCampusIds,
  type ScheduleOptionsResponse,
  ScheduleOptionsResponseSchema,
  type SchedulePinnedInputs,
  SchedulePinnedInputsSchema,
} from '@caa/api-contract';
import { ScheduleLimitation, ScheduleOutcome } from '@caa/domain';

import { SYNTHETIC_CAMPUSES } from '../fixtures/synthetic-campuses';
import { syntheticId } from '../fixtures/synthetic-id';
import { SYNTHETIC_SCHEDULE_TERM } from '../fixtures/synthetic-schedule-term';
import { buildScheduleOption } from './schedule-option.builder';

/** Raw input accepted for a response, as the contract schema reads it. */
export type ScheduleOptionsResponseInput = z.input<typeof ScheduleOptionsResponseSchema>;

/**
 * The pinned inputs of a synthetic response: student snapshot seed 1, recorded 2026-09-01 06:00Z
 * with the `demo-audit` audit `audit_demo_r1`, ruleset and transition table `demo-2026.1`,
 * section snapshot seed 1, the default work cap, and a fixed request hash.
 */
export const SYNTHETIC_SCHEDULE_PINNED_INPUTS: SchedulePinnedInputs =
  SchedulePinnedInputsSchema.parse({
    studentSnapshotId: syntheticId('studentSnapshot', 1),
    studentRecordEffectiveAt: '2026-09-01T06:00:00.000Z',
    auditRecordEffectiveAt: '2026-09-01T06:00:00.000Z',
    auditSource: 'demo-audit',
    auditVersion: 'audit_demo_r1',
    rulesetVersion: 'demo-2026.1',
    sectionSnapshotId: syntheticId('sectionSnapshot', 1),
    campusTransitionVersion: 'demo-2026.1',
    solverWorkCap: 3_000_000,
    constraintHash: `sha256:${'0a'.repeat(32)}`,
  });

/**
 * Names a campus ID for display: the synthetic campus's name when it is one of the two fixed
 * campuses, else a synthetic name that carries the ID.
 *
 * @param id - The campus ID the response names.
 * @returns The campus display entry.
 */
function displayCampus(id: string): { id: string; name: string } {
  const known = Object.values(SYNTHETIC_CAMPUSES).find((campus) => campus.id === id);
  return { id, name: known?.name ?? `Demo Campus ${id}` };
}

/**
 * Builds a valid schedule-options response. By default it is a complete `OPTIONS_FOUND` with
 * one option from `buildScheduleOption`, the option's courses as `courseIds`, every limitation
 * code, the synthetic pinned inputs, and no catalog entries. `term` is the synthetic schedule
 * term (2027SP, the term of the section builders). `campuses` lists exactly the campuses the
 * built response names, ascending by ID, so an override of `options`, `conflictSet` or
 * `unresolved` gets a matching list unless `campuses` is overridden too.
 *
 * `courseIds` follow the first option's bundles unless given. Change the outcome together with
 * the fields it governs: for example `SEARCH_TIMEOUT` needs `searchComplete: false` and no
 * options, and `NO_FEASIBLE_PLAN` needs a `conflictSet`.
 *
 * @param overrides - Fields to change.
 * @returns The response, parsed by the contract.
 */
export function buildScheduleOptionsResponse(
  overrides: Partial<ScheduleOptionsResponseInput> = {},
): ScheduleOptionsResponse {
  const options = overrides.options ?? [buildScheduleOption()];
  const [first] = options;
  const courseIds = first === undefined ? [] : first.bundles.map((bundle) => bundle.courseId);
  const response = ScheduleOptionsResponseSchema.parse({
    outcome: ScheduleOutcome.OptionsFound,
    searchComplete: true,
    courseIds,
    conflictSet: null,
    unresolved: [],
    limitations: Object.values(ScheduleLimitation),
    pinnedInputs: SYNTHETIC_SCHEDULE_PINNED_INPUTS,
    courses: [],
    term: {
      id: SYNTHETIC_SCHEDULE_TERM.termId,
      termCode: SYNTHETIC_SCHEDULE_TERM.termCode,
      startsOn: SYNTHETIC_SCHEDULE_TERM.startsOn,
      endsOn: SYNTHETIC_SCHEDULE_TERM.endsOn,
    },
    ...overrides,
    options,
  });
  if (overrides.campuses !== undefined) return response;
  return ScheduleOptionsResponseSchema.parse({
    ...response,
    campuses: namedCampusIds(response).map(displayCampus),
  });
}
