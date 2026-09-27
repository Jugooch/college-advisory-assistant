/**
 * @file Lifecycle status of a course attempt.
 * @module @caa/domain/enums/attempt-status
 * @requirement FR-05
 * @requirement FR-06
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

/**
 * Status of one course attempt. Repeats of a course are separate attempts, each with its own
 * status.
 *
 * - `COMPLETED`: finished at this institution; may carry a grade and earned credits.
 * - `IN_PROGRESS`: currently enrolled; no grade and no earned credits yet.
 * - `WITHDRAWN`: dropped after the add/drop period; earns no credits.
 * - `INCOMPLETE`: grade deferred; earns no credits until resolved.
 * - `TRANSFER_PENDING`: transfer credit under evaluation; no grade and no earned credits yet.
 * - `TRANSFER_AWARDED`: transfer credit accepted; may carry a grade and earned credits.
 */
export const AttemptStatus = {
  Completed: 'COMPLETED',
  InProgress: 'IN_PROGRESS',
  Withdrawn: 'WITHDRAWN',
  Incomplete: 'INCOMPLETE',
  TransferPending: 'TRANSFER_PENDING',
  TransferAwarded: 'TRANSFER_AWARDED',
} as const;

/** Union of every {@link AttemptStatus} value. */
export type AttemptStatus = (typeof AttemptStatus)[keyof typeof AttemptStatus];

/** Runtime schema for {@link AttemptStatus}. */
export const AttemptStatusSchema = z.enum(AttemptStatus);
