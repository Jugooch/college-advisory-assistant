/**
 * @file Pinned inputs of a schedule-options response: what the options were computed from.
 * @module @caa/api-contract/contracts/schedule-pinned-inputs
 * @requirement NFR-01
 * @requirement NFR-07
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { z } from 'zod';

import { SectionSnapshotIdSchema } from '@caa/domain';

import { PinnedInputsSchema } from './course-checks.contract';

/** Most solver work units a request may use (ADR-0010 §1). */
export const MAX_SOLVER_WORK_CAP = 3_000_000;

/**
 * The inputs every option was computed from, so the response can be reproduced: the course
 * checks' pinned inputs plus the section data, the transition table, the work cap, and the
 * request itself (ADR-0010 §7). The same pinned inputs and cap give a deep-equal response.
 */
export const SchedulePinnedInputsSchema = PinnedInputsSchema.unwrap()
  .extend({
    sectionSnapshotId: SectionSnapshotIdSchema,
    /**
     * Version of the tenant's campus transition table, or `null` when the tenant has none, in
     * which case every pair of different campuses is unknown, never zero minutes.
     */
    campusTransitionVersion: z.string().min(1).nullable(),
    /** The solver work cap the search ran under (ADR-0010 §1). */
    solverWorkCap: z.number().int().min(1).max(MAX_SOLVER_WORK_CAP),
    /** `sha256:` and the lowercase hex SHA-256 of the normalized request's canonical JSON. */
    constraintHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  })
  .readonly();

/** Pinned inputs of a schedule-options response. */
export type SchedulePinnedInputs = z.infer<typeof SchedulePinnedInputsSchema>;
