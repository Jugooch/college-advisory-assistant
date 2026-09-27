/**
 * @file Idempotent roster import: validates a synthetic roster batch and publishes it atomically.
 * @module @caa/worker/jobs/import-roster
 * @requirement FR-03
 * @see docs/planning/09-data-model-and-integration-contracts.md
 * @see docs/planning/07-system-architecture-and-design.md
 */
import { z } from 'zod';

import type { ImportBatchRepository, QuarantinedRow, RosterRepository } from '@caa/db';
import {
  type ImportBatch,
  ImportOperation,
  type InstitutionId,
  InstitutionIdSchema,
  type RosterRow,
} from '@caa/domain';

import {
  parseSyntheticRoster,
  type RosterBatchRejectionReason,
} from '../adapters/synthetic/synthetic-roster.adapter';
import type { JobDefinition } from '../shared/job-definition';
import type { JobLogger } from '../shared/job-logger';

/** Queue name of the roster import job. */
export const IMPORT_ROSTER_JOB_NAME = 'import-roster';

/** Job payload. Tenant and source are set by the scheduler, never taken from the document. */
const ImportRosterPayloadSchema = z.object({
  tenantId: InstitutionIdSchema,
  sourceId: z.string().min(1),
  /** Synthetic roster document exactly as received, shaped `{ batch, rows }`. */
  document: z.unknown(),
});

/** Raw payload accepted by the roster import job. */
export type ImportRosterPayload = z.input<typeof ImportRosterPayloadSchema>;

/** Row counts of a parsed batch. */
export interface ImportRosterCounts {
  /** Rows in the batch, tombstones and invalid rows included. */
  readonly recordCount: number;
  readonly validCount: number;
  readonly quarantinedCount: number;
}

/**
 * What happened to a batch whose envelope was valid.
 *
 * - `PUBLISHED`: valid rows published and invalid rows quarantined, in one transaction.
 * - `ALREADY_IMPORTED`: the same key and checksum were already recorded; nothing changed.
 * - `CONFLICT`: the key was recorded with a different checksum; nothing written.
 * - `QUARANTINED`: too many invalid rows; the batch is recorded as quarantined, no student changes.
 * - `REJECTED_STALE`: older than the newest published batch from the source; nothing written.
 * - `REJECTED_UNSUPPORTED`: a `FULL` snapshot, which is not reconciled yet; nothing written.
 */
export type ImportRosterOutcome =
  | 'PUBLISHED'
  | 'ALREADY_IMPORTED'
  | 'CONFLICT'
  | 'QUARANTINED'
  | 'REJECTED_STALE'
  | 'REJECTED_UNSUPPORTED';

/** Result of one run of the roster import job. */
export type ImportRosterResult =
  | {
      readonly outcome: ImportRosterOutcome;
      /** Source-supplied batch identifier. */
      readonly batchId: string;
      readonly counts: ImportRosterCounts;
    }
  | {
      /** The payload, envelope, count, or checksum was invalid; nothing written. */
      readonly outcome: 'REJECTED_INVALID';
      readonly reason: RosterBatchRejectionReason | 'invalid_job_payload';
    };

/** Dependencies of the roster import job. */
export interface ImportRosterJobDependencies {
  readonly importBatches: ImportBatchRepository;
  readonly rosters: RosterRepository;
  readonly logger: JobLogger;
  /** Largest share of invalid rows, in whole percent (0-100), that still publishes the batch. */
  readonly maxInvalidRowPercent: number;
}

/** The roster import job. It validates its own payload, so it accepts `unknown`. */
export type ImportRosterJob = JobDefinition<unknown, ImportRosterResult>;

/** A parsed batch ready for the idempotency, freshness, and threshold decisions. */
interface ParsedRoster {
  readonly tenantId: InstitutionId;
  readonly batch: ImportBatch;
  readonly rows: readonly RosterRow[];
  readonly quarantined: readonly QuarantinedRow[];
}

/**
 * Compares a batch with any batch already recorded under its idempotency key.
 *
 * @param importBatches - Import batch repository.
 * @param roster - Parsed batch.
 * @returns `ALREADY_IMPORTED`, `CONFLICT`, or null when the key is new.
 */
async function findReplay(
  importBatches: ImportBatchRepository,
  roster: ParsedRoster,
): Promise<'ALREADY_IMPORTED' | 'CONFLICT' | null> {
  const { batch } = roster;
  const recorded = await importBatches.findByKey(roster.tenantId, batch.sourceId, batch.batchId);
  if (recorded === null) return null;
  // SAFETY: the same key with a different checksum is a conflict, never a silent replacement.
  return recorded.checksum === batch.checksum ? 'ALREADY_IMPORTED' : 'CONFLICT';
}

/**
 * Tells whether a newer batch from the same source has already been published.
 *
 * @param importBatches - Import batch repository.
 * @param roster - Parsed batch.
 * @returns True when the batch is older than the newest published one.
 */
async function isStale(
  importBatches: ImportBatchRepository,
  roster: ParsedRoster,
): Promise<boolean> {
  const { batch } = roster;
  const latest = await importBatches.findLatestPublishedEffectiveAt(
    roster.tenantId,
    batch.sourceId,
  );
  // SAFETY: a late, older batch must not replace newer truth (docs/planning/09).
  return latest !== null && Date.parse(batch.sourceEffectiveAt) < Date.parse(latest);
}

/**
 * Publishes or quarantines the batch in one repository transaction.
 *
 * @param dependencies - Job dependencies.
 * @param roster - Parsed batch.
 * @returns The outcome that was written, or the replay outcome when a concurrent run won.
 * @throws {Error} When the write fails and the key is still unrecorded.
 */
async function writeRoster(
  dependencies: ImportRosterJobDependencies,
  roster: ParsedRoster,
): Promise<ImportRosterOutcome> {
  const { batch, rows, quarantined, tenantId } = roster;
  // NOTE: integer arithmetic, so the threshold comparison is exact.
  const isOverThreshold =
    quarantined.length * 100 > dependencies.maxInvalidRowPercent * batch.recordCount;
  try {
    if (isOverThreshold) {
      await dependencies.rosters.quarantineRoster(tenantId, { batch, quarantined });
      return 'QUARANTINED';
    }
    await dependencies.rosters.publishRoster(tenantId, { batch, rows, quarantined });
    return 'PUBLISHED';
  } catch (error) {
    // NOTE: a second delivery of the same job can record the key between the lookup and this
    // write; the unique key then rejects this write, and the replay check reports it.
    const replay = await findReplay(dependencies.importBatches, roster);
    if (replay === null) throw error;
    return replay;
  }
}

/**
 * Decides and applies the outcome for a parsed batch.
 *
 * @param dependencies - Job dependencies.
 * @param roster - Parsed batch.
 * @returns The outcome.
 */
async function importParsedRoster(
  dependencies: ImportRosterJobDependencies,
  roster: ParsedRoster,
): Promise<ImportRosterOutcome> {
  if (roster.batch.operation === ImportOperation.Full) {
    // TODO(#30): reconcile FULL snapshots. Until then a FULL batch changes nothing, so a missing
    // student is never deleted and a quarantined row is never read as a removal.
    return 'REJECTED_UNSUPPORTED';
  }
  const replay = await findReplay(dependencies.importBatches, roster);
  if (replay !== null) return replay;
  if (await isStale(dependencies.importBatches, roster)) return 'REJECTED_STALE';
  return writeRoster(dependencies, roster);
}

/**
 * Runs one roster import for a validated payload.
 *
 * @param dependencies - Job dependencies.
 * @param request - Validated job payload.
 * @returns The typed result.
 */
async function importRoster(
  dependencies: ImportRosterJobDependencies,
  request: z.output<typeof ImportRosterPayloadSchema>,
): Promise<ImportRosterResult> {
  const { tenantId, sourceId, document } = request;
  const parsed = parseSyntheticRoster(document, { tenantId, sourceId });
  if (!parsed.isValid) return { outcome: 'REJECTED_INVALID', reason: parsed.reason };
  const outcome = await importParsedRoster(dependencies, { tenantId, ...parsed });
  return {
    outcome,
    batchId: parsed.batch.batchId,
    counts: {
      recordCount: parsed.batch.recordCount,
      validCount: parsed.rows.length,
      quarantinedCount: parsed.quarantined.length,
    },
  };
}

/**
 * Builds the log fields for a result.
 *
 * @param result - Job result.
 * @returns Flat fields with the outcome, batch ID, and counts or reason.
 */
function toLogFields(result: ImportRosterResult): Readonly<Record<string, unknown>> {
  // SECURITY: opaque IDs and counts only; source student IDs are never logged.
  if ('reason' in result) return { outcome: result.outcome, reason: result.reason };
  return { outcome: result.outcome, batchId: result.batchId, ...result.counts };
}

/**
 * Creates the roster import job.
 *
 * @param dependencies - Repositories, logger, and the invalid-row threshold.
 * @returns The job definition.
 */
export function createImportRosterJob(dependencies: ImportRosterJobDependencies): ImportRosterJob {
  return {
    name: IMPORT_ROSTER_JOB_NAME,
    async handle(payload) {
      const request = ImportRosterPayloadSchema.safeParse(payload);
      if (!request.success) {
        const result: ImportRosterResult = {
          outcome: 'REJECTED_INVALID',
          reason: 'invalid_job_payload',
        };
        dependencies.logger.warn(toLogFields(result), 'roster import not published');
        return result;
      }
      const result = await importRoster(dependencies, request.data);
      const { tenantId, sourceId } = request.data;
      const fields = { tenantId, sourceId, ...toLogFields(result) };
      if (result.outcome === 'PUBLISHED' || result.outcome === 'ALREADY_IMPORTED') {
        dependencies.logger.info(fields, 'roster import finished');
      } else {
        dependencies.logger.warn(fields, 'roster import not published');
      }
      return result;
    },
  };
}
