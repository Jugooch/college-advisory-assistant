/**
 * @file Retention for the content-free student turn log behind the conversation rate limit.
 * @module @caa/db/repositories/student-turn-log
 * @requirement FR-14
 * @requirement NFR-08
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { and, eq, lt } from 'drizzle-orm';

import type { InstitutionId } from '@caa/domain';

import type { Database } from '../client';
import { studentTurnLogTable } from '../tables/conversation.table';

/** Which log rows to delete. */
export interface PruneStudentTurnLogRequest {
  readonly tenantId: InstitutionId;
  /** Rows created before this instant (ISO 8601) are deleted. A row created exactly then is kept. */
  readonly before: string;
}

/** Retention for the student turn log. Rows are only ever deleted by age, never read back. */
export interface StudentTurnLogRepository {
  /**
   * Deletes the tenant's log rows older than an instant. Running it again deletes nothing more.
   *
   * @param request - Tenant and the cutoff instant.
   * @returns The number of rows deleted.
   */
  pruneBefore(request: PruneStudentTurnLogRequest): Promise<number>;
}

/**
 * Creates the student turn log repository.
 *
 * @param db - Typed database handle.
 * @returns A {@link StudentTurnLogRepository}.
 */
export function createStudentTurnLogRepository(db: Database): StudentTurnLogRepository {
  return {
    async pruneBefore({ tenantId, before }) {
      const deleted = await db
        .delete(studentTurnLogTable)
        .where(
          and(
            eq(studentTurnLogTable.tenantId, tenantId),
            lt(studentTurnLogTable.createdAt, new Date(before)),
          ),
        )
        .returning({ id: studentTurnLogTable.id });
      return deleted.length;
    },
  };
}
