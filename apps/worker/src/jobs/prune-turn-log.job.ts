/**
 * @file Idempotent retention job: deletes turn-log rows older than the rate-limit window.
 * @module @caa/worker/jobs/prune-turn-log
 * @requirement FR-14
 * @requirement NFR-08
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

import type { StudentTurnLogRepository } from '@caa/db';
import { InstitutionIdSchema } from '@caa/domain';

import type { JobDefinition } from '../shared/job-definition';
import type { JobLogger } from '../shared/job-logger';

/** Queue name of the turn-log retention job. */
export const PRUNE_TURN_LOG_JOB_NAME = 'prune-turn-log';

const MS_PER_MINUTE = 60_000;

/** Job payload. The tenant is set by the scheduler. */
const PruneTurnLogPayloadSchema = z.object({ tenantId: InstitutionIdSchema });

/** Result of one run of the turn-log retention job. */
export type PruneTurnLogResult =
  | { readonly outcome: 'PRUNED'; readonly deletedCount: number; readonly cutoff: string }
  | { readonly outcome: 'REJECTED_INVALID' };

/** Dependencies of the turn-log retention job. */
export interface PruneTurnLogJobDependencies {
  readonly turnLog: StudentTurnLogRepository;
  readonly logger: JobLogger;
  /** Returns the current time. Injected so the cutoff is deterministic in tests. */
  readonly now: () => Date;
  /**
   * Retention in minutes: at least the longest rate-limit window, or pruning would lower the
   * count the limit reads (ADR-0015 §2).
   */
  readonly turnLogRetentionMinutes: number;
}

/** The turn-log retention job. It validates its own payload, so it accepts `unknown`. */
export type PruneTurnLogJob = JobDefinition<unknown, PruneTurnLogResult>;

/**
 * Creates the turn-log retention job. Rows created exactly at the cutoff are kept, and a repeat
 * run deletes nothing more.
 *
 * @param dependencies - Repository, logger, clock, and retention.
 * @returns The job definition.
 */
export function createPruneTurnLogJob(dependencies: PruneTurnLogJobDependencies): PruneTurnLogJob {
  return {
    name: PRUNE_TURN_LOG_JOB_NAME,
    async handle(payload) {
      const parsed = PruneTurnLogPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        dependencies.logger.warn({ job: PRUNE_TURN_LOG_JOB_NAME }, 'invalid job payload');
        return { outcome: 'REJECTED_INVALID' };
      }
      const { tenantId } = parsed.data;
      const cutoff = new Date(
        dependencies.now().getTime() - dependencies.turnLogRetentionMinutes * MS_PER_MINUTE,
      ).toISOString();
      const deletedCount = await dependencies.turnLog.pruneBefore({ tenantId, before: cutoff });
      dependencies.logger.info({ tenantId, deletedCount, cutoff }, 'turn log pruned');
      return { outcome: 'PRUNED', deletedCount, cutoff };
    },
  };
}
