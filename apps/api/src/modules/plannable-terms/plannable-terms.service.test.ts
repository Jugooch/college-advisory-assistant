/**
 * @file Tests for the plannable terms service with injected fakes: access, freshness at the
 * boundaries, ties, order, the tenant, and the log line.
 * @requirement FR-08
 * @requirement NFR-01
 * @requirement NFR-04
 */
import { describe, expect, it, vi } from 'vitest';

import type { TermLatestSectionSnapshot, TermSectionSnapshotRepository } from '@caa/db';
import { buildActor, buildSectionSnapshot, buildStudent, buildTerm } from '@caa/test-kit';

import { NotFoundError } from '../../shared/domain-errors';
import { createRecordingLogger } from '../../testing/in-memory-repositories';
import { createPlannableTermsService } from './plannable-terms.service';

const NOW = new Date('2026-09-02T00:00:00.000Z');
const MAX_AGE_MS = 86_400_000;
const ACTOR = buildActor();
const STUDENT = buildStudent();
const FALL = buildTerm({ termCode: '2026FA', sequence: 1 }, 1);
const SPRING = buildTerm({ termCode: '2027SP', sequence: 2 }, 2);

/**
 * Builds a listing entry whose latest snapshot is found at the given time.
 *
 * @param term - The term.
 * @param sourceEffectiveAt - The head's source time.
 * @returns The entry.
 */
function found(term: TermLatestSectionSnapshot['term'], sourceEffectiveAt: string) {
  const { id } = buildSectionSnapshot({ termId: term.id });
  return {
    term,
    latest: { status: 'FOUND' as const, sectionSnapshotId: id, sourceEffectiveAt },
  };
}

/**
 * Runs the service over a fixed listing.
 *
 * @param entries - What the repository returns.
 * @param isAllowed - The access decision.
 * @returns The result promise, the logger, and the repository spy.
 */
function run(entries: readonly TermLatestSectionSnapshot[], isAllowed = true) {
  const logger = createRecordingLogger();
  const listLatestPublishedByTerm = vi.fn(() => Promise.resolve(entries));
  const sectionSnapshots: TermSectionSnapshotRepository = {
    findLatestPublished: () => Promise.resolve(null),
    listLatestPublishedByTerm,
  };
  const service = createPlannableTermsService({
    access: { canViewStudent: () => Promise.resolve(isAllowed) },
    sectionSnapshots,
    now: () => NOW,
    maxSourceAgeMs: MAX_AGE_MS,
  });
  return {
    result: service.listPlannableTerms(ACTOR, STUDENT.id, { logger }),
    logger,
    listLatestPublishedByTerm,
  };
}

describe('createPlannableTermsService', () => {
  it('lists fresh terms in the repository order, minimized to the contract fields', async () => {
    const { result, listLatestPublishedByTerm } = run([
      found(FALL, '2026-09-01T12:00:00.000Z'),
      found(SPRING, '2026-09-01T12:00:00.000Z'),
    ]);

    expect(await result).toEqual({
      terms: [FALL, SPRING].map(({ id, termCode, startsOn, endsOn }) => ({
        id,
        termCode,
        startsOn,
        endsOn,
      })),
    });
    expect(listLatestPublishedByTerm).toHaveBeenCalledWith(ACTOR.tenantId);
  });

  it.each([
    ['exactly at the maximum age', '2026-09-01T00:00:00.000Z', true],
    ['1 ms past the maximum age', '2026-08-31T23:59:59.999Z', false],
    ['5 minutes ahead', '2026-09-02T00:05:00.000Z', true],
    ['more than 5 minutes ahead', '2026-09-02T00:05:00.001Z', false],
  ])('treats a head %s as plannable: %s', async (_case, time, isPlannable) => {
    const { result } = run([found(FALL, time)]);

    expect((await result).terms).toHaveLength(isPlannable ? 1 : 0);
  });

  it('leaves out stale and tied terms and logs each with its reason, no student data', async () => {
    const { result, logger } = run([
      found(FALL, '2026-08-01T00:00:00.000Z'),
      { term: SPRING, latest: { status: 'AMBIGUOUS' } },
    ]);

    expect(await result).toEqual({ terms: [] });
    expect(logger.entries).toEqual([
      {
        level: 'info',
        message: 'plannable terms listed',
        details: {
          tenantId: ACTOR.tenantId,
          listedCount: 0,
          excluded: [
            { termId: FALL.id, reason: 'STALE' },
            { termId: SPRING.id, reason: 'AMBIGUOUS' },
          ],
        },
      },
    ]);
    expect(JSON.stringify(logger.entries)).not.toContain(STUDENT.id);
  });

  it('returns an empty list, not an error, when no term has a snapshot', async () => {
    expect(await run([]).result).toEqual({ terms: [] });
  });

  it('throws NOT_FOUND and reads nothing when the actor may not see the student', async () => {
    const { result, listLatestPublishedByTerm } = run(
      [found(FALL, '2026-09-01T12:00:00.000Z')],
      false,
    );

    await expect(result).rejects.toBeInstanceOf(NotFoundError);
    expect(listLatestPublishedByTerm).not.toHaveBeenCalled();
  });
});
