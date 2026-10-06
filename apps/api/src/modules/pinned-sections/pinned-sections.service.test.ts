/**
 * @file Tests for the pinned sections service: session scoping, missing and tied snapshots, the
 * out-of-scope backstop for snapshots and transition tables, and ID-only logging.
 * @requirement FR-07
 * @requirement NFR-04
 */
import { describe, expect, it } from 'vitest';

import type { CampusTransitionRepository, SectionSnapshotRepository } from '@caa/db';
import { TermIdSchema } from '@caa/domain';
import {
  buildActor,
  buildCampusTransitionPolicy,
  buildStudent,
  SYNTHETIC_SCHEDULE_TERM,
  SYNTHETIC_TENANTS,
  syntheticId,
} from '@caa/test-kit';

import {
  NotFoundError,
  SourceUnavailableError,
  StaleSourceError,
} from '../../shared/domain-errors';
import { createRecordingLogger } from '../../testing/in-memory-repositories';
import { buildScheduleSnapshot } from '../../testing/schedule-options-harness';
import { createPinnedSectionsService } from './pinned-sections.service';

const actor = buildActor();
const student = buildStudent({ userId: actor.userId });
const termId = TermIdSchema.parse(SYNTHETIC_SCHEDULE_TERM.termId);
const snapshot = buildScheduleSnapshot();
const policy = buildCampusTransitionPolicy();

/** What the fake repositories answer. */
interface Setup {
  readonly latest?: Awaited<ReturnType<SectionSnapshotRepository['findLatestPublished']>>;
  readonly policy?: Awaited<ReturnType<CampusTransitionRepository['findPolicy']>>;
}

/**
 * Loads the term's sections as `actor` over fake repositories that record their arguments.
 *
 * @param setup - What the repositories answer.
 * @returns The load's promise, the logger, and the repository calls.
 */
function load(setup: Setup = {}) {
  const calls: unknown[] = [];
  const logger = createRecordingLogger();
  const unavailable: unknown[] = [];
  const service = createPinnedSectionsService({
    sectionSnapshots: {
      findLatestPublished: (...args) => {
        calls.push(['sections', ...args]);
        return Promise.resolve(
          setup.latest === undefined ? { status: 'FOUND', snapshot } : setup.latest,
        );
      },
    },
    campusTransitions: {
      findPolicy: (...args) => {
        calls.push(['transitions', ...args]);
        return Promise.resolve(setup.policy === undefined ? policy : setup.policy);
      },
    },
    pinnedRecords: { recordUnavailable: (_scope, reason) => unavailable.push(reason) },
  });
  const scope = { actor, studentId: student.id, context: { logger } };
  return { result: service.load(scope, termId), logger, calls, unavailable };
}

describe('PinnedSectionsService.load', () => {
  it('returns the snapshot and table, read for the session tenant and the term only', async () => {
    const { result, calls } = load();

    await expect(result).resolves.toEqual({ snapshot, transitionPolicy: policy });
    expect(calls).toEqual([
      ['sections', actor.tenantId, termId],
      ['transitions', actor.tenantId],
    ]);
  });

  it('returns no table, never an assumed one, when the tenant has none', async () => {
    await expect(load({ policy: null }).result).resolves.toMatchObject({ transitionPolicy: null });
  });

  it('throws SOURCE_UNAVAILABLE and logs the reason when the term has no snapshot', async () => {
    const { result, unavailable } = load({ latest: null });

    await expect(result).rejects.toBeInstanceOf(SourceUnavailableError);
    expect(unavailable).toEqual(['NO_SECTION_SNAPSHOT']);
  });

  it('throws STALE_SOURCE, never a pick, when two snapshots tie for latest', async () => {
    const { result, unavailable } = load({ latest: { status: 'AMBIGUOUS' } });

    await expect(result).rejects.toBeInstanceOf(StaleSourceError);
    expect(unavailable).toEqual(['SECTION_SNAPSHOT_AMBIGUOUS']);
  });

  it.each([
    ['another tenant', { ...snapshot, tenantId: SYNTHETIC_TENANTS.b.id }],
    ['another term', { ...snapshot, termId: TermIdSchema.parse(syntheticId('term', 9)) }],
  ])('returns NOT_FOUND and logs a security event for a snapshot of %s', async (_case, foreign) => {
    const { result, logger } = load({ latest: { status: 'FOUND', snapshot: foreign } });

    await expect(result).rejects.toBeInstanceOf(NotFoundError);
    expect(logger.entries.map((entry) => [entry.level, entry.details.recordId])).toEqual([
      ['warn', snapshot.id],
    ]);
  });

  it("returns NOT_FOUND for another tenant's transition table", async () => {
    const foreign = buildCampusTransitionPolicy({ tenantId: SYNTHETIC_TENANTS.b.id });

    await expect(load({ policy: foreign }).result).rejects.toBeInstanceOf(NotFoundError);
  });
});
