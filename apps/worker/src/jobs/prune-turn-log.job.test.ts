/**
 * @file Tests for the turn-log retention job against an in-memory fake repository.
 */
import { describe, expect, it, vi } from 'vitest';

import type { StudentTurnLogRepository } from '@caa/db';
import { SYNTHETIC_TENANTS } from '@caa/test-kit';

import { createPruneTurnLogJob } from './prune-turn-log.job';

const TENANT_ID = SYNTHETIC_TENANTS.a.id;
const NOW = new Date('2026-10-08T12:00:00.000Z');

/**
 * Builds the job over a fake log holding the given creation times, with the real rule of
 * deleting only rows strictly older than the cutoff.
 *
 * @param times - Creation times of the stored rows, ISO 8601.
 * @returns The job, the surviving times, and the logger spies.
 */
function setup(times: string[]) {
  const rows = [...times];
  const turnLog: StudentTurnLogRepository = {
    async pruneBefore({ before }) {
      const kept = rows.filter((time) => new Date(time) >= new Date(before));
      const deleted = rows.length - kept.length;
      rows.splice(0, rows.length, ...kept);
      return deleted;
    },
  };
  const logger = { info: vi.fn(), warn: vi.fn() };
  const job = createPruneTurnLogJob({
    turnLog,
    logger,
    now: () => NOW,
    turnLogRetentionMinutes: 60,
  });
  return { job, rows, logger };
}

describe('prune turn log job', () => {
  it('deletes rows older than the window and keeps the row exactly at the cutoff', async () => {
    const { job, rows } = setup([
      '2026-10-08T10:59:59.999Z',
      '2026-10-08T11:00:00.000Z',
      '2026-10-08T11:00:00.001Z',
    ]);

    const result = await job.handle({ tenantId: TENANT_ID });

    expect(result).toEqual({
      outcome: 'PRUNED',
      deletedCount: 1,
      cutoff: '2026-10-08T11:00:00.000Z',
    });
    expect(rows).toEqual(['2026-10-08T11:00:00.000Z', '2026-10-08T11:00:00.001Z']);
  });

  it('keeps every row inside the window', async () => {
    const { job, rows } = setup(['2026-10-08T11:30:00.000Z', '2026-10-08T12:00:00.000Z']);

    const result = await job.handle({ tenantId: TENANT_ID });

    expect(result).toMatchObject({ outcome: 'PRUNED', deletedCount: 0 });
    expect(rows).toHaveLength(2);
  });

  it('deletes nothing more when delivered twice', async () => {
    const { job } = setup(['2026-10-08T09:00:00.000Z']);
    await job.handle({ tenantId: TENANT_ID });

    expect(await job.handle({ tenantId: TENANT_ID })).toMatchObject({ deletedCount: 0 });
  });

  it('rejects an invalid payload without touching the log', async () => {
    const { job, rows, logger } = setup(['2026-10-08T09:00:00.000Z']);

    expect(await job.handle({ tenantId: 'not-a-uuid' })).toEqual({ outcome: 'REJECTED_INVALID' });
    expect(rows).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
