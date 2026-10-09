/**
 * @file Acceptance AC14 (planning/13, ADR-0013 §3): a source outage during plan reopen shows the
 * historical plan and withholds current validity. With a current source unreadable the draft reads
 * UNKNOWN with SOURCE_UNAVAILABLE, never CURRENT, and the revision is still returned in full.
 * @requirement FR-02
 * @requirement NFR-05
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { buildAcademicApp, createAcademicWorld } from '../support/academic-endpoints-harness';
import { acceptanceIt } from '../support/known-findings-declarations';
import {
  dataOf,
  latestFreshness,
  readPlanAt,
  resetPlanWorld,
  saveDefaultOption,
  storedPartOf,
  supersedeSections,
} from '../support/plan-drafts-harness';

const world = createAcademicWorld();

// NOTE: built once at module scope, like AC15 and AC21, so Fastify's first build doesn't count
// against a case's timeout.
const app = buildAcademicApp(world);

describe('AC14 plan reopen during a source outage', () => {
  beforeEach(() => {
    resetPlanWorld(world);
  });

  acceptanceIt(
    'AC14',
    'reads 200 with freshness UNKNOWN and SOURCE_UNAVAILABLE, never CURRENT, when a source is unreadable',
    async () => {
      const saved = await saveDefaultOption(app);
      world.sectionSnapshots = [];

      const read = await readPlanAt(app, `/${String(dataOf(saved).id)}`);

      expect(read.statusCode).toBe(200);
      expect(latestFreshness(read)).toMatchObject({
        state: 'UNKNOWN',
        reasons: ['SOURCE_UNAVAILABLE'],
      });
    },
  );

  acceptanceIt(
    'AC14',
    'still returns the historical revision in full with its original createdAt and states',
    async () => {
      const saved = await saveDefaultOption(app);
      const planId = String(dataOf(saved).id);
      const before = await readPlanAt(app, `/${planId}/revisions/1`);
      world.sectionSnapshots = [];

      const after = await readPlanAt(app, `/${planId}/revisions/1`);

      expect(after.statusCode).toBe(200);
      expect(dataOf(after)).toMatchObject({
        revision: 1,
        createdAt: '2026-09-01T12:00:00.000Z',
        outcome: 'OPTIONS_FOUND',
        resultUnavailable: false,
        freshness: { state: 'UNKNOWN' },
      });
      expect(storedPartOf(after)).toEqual(storedPartOf(before));
    },
  );

  acceptanceIt(
    'AC14',
    'lists the proven reasons next to SOURCE_UNAVAILABLE and still reads UNKNOWN',
    async () => {
      const saved = await saveDefaultOption(app);
      supersedeSections(world);
      world.audits = [];

      const read = await readPlanAt(app, `/${String(dataOf(saved).id)}`);

      expect(read.statusCode).toBe(200);
      expect(latestFreshness(read)).toMatchObject({ state: 'UNKNOWN' });
      expect((latestFreshness(read) as { reasons: string[] }).reasons.toSorted()).toEqual([
        'SECTIONS_SUPERSEDED',
        'SOURCE_UNAVAILABLE',
      ]);
    },
  );
});
