/**
 * @file Acceptance AC33 (planning/13, ADR-0013 §3): a saved draft reads STALE with each reason
 * after supersession or age, exactly at the maximum age it is CURRENT, and the historical revision
 * is returned unchanged with its original time and no current-validity claim. The maximum age is
 * 24 hours (`ACADEMIC_SOURCE_MAX_AGE_MS` = 86,400,000 ms in the harness). The pinned section
 * snapshot is the oldest pinned source, in effect since 2026-09-01T05:00:00.000Z, so it reaches
 * the maximum age at 2026-09-02T05:00:00.000Z.
 * @requirement FR-02
 * @requirement FR-11
 * @requirement NFR-05
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import { beforeEach, describe, expect } from 'vitest';

import { buildAcademicApp, createAcademicWorld } from '../support/academic-endpoints-harness';
import type { AcceptanceApp, AcceptanceResponse } from '../support/api-harness';
import { acceptanceIt } from '../support/known-findings';
import {
  dataOf,
  expectSaved,
  keysAndStrings,
  latestFreshness,
  readPlanAt,
  resetPlanWorld,
  saveDefaultOption,
  storedPartOf,
  supersedeAudit,
  supersedeSections,
  supersedeStudentRecord,
  supersedeTransitionTable,
} from '../support/plan-drafts-harness';

const world = createAcademicWorld();

// NOTE: apps are built once at module scope so Fastify's first build doesn't count against a
// case's timeout. They share one world and differ only in the clock or the active ruleset.
const app = buildAcademicApp(world);
const atMaxAge = buildAcademicApp(world, { now: new Date('2026-09-02T05:00:00.000Z') });
const pastMaxAge = buildAcademicApp(world, { now: new Date('2026-09-02T05:00:00.001Z') });
const rulesetChanged = buildAcademicApp(world, { rulesetVersion: 'demo-2026.2' });

/**
 * Saves the default option with the default app and reads the plan back with another app.
 *
 * @param reader - The app that reads the plan, at its own clock and ruleset.
 * @returns The plan response.
 */
async function savedPlanReadBy(reader: AcceptanceApp): Promise<AcceptanceResponse> {
  const saved = await saveDefaultOption(app);
  expectSaved(saved);
  return readPlanAt(reader, `/${String(dataOf(saved).id)}`);
}

describe('AC33 plan draft staleness is derived at read time', () => {
  beforeEach(() => {
    resetPlanWorld(world);
  });

  acceptanceIt(
    'AC33',
    'reads STALE with STUDENT_RECORD_SUPERSEDED after a newer student snapshot',
    async () => {
      const saved = await saveDefaultOption(app);
      supersedeStudentRecord(world);

      const read = await readPlanAt(app, `/${String(dataOf(saved).id)}`);

      expect(latestFreshness(read)).toMatchObject({
        state: 'STALE',
        reasons: ['STUDENT_RECORD_SUPERSEDED'],
      });
    },
  );

  acceptanceIt('AC33', 'reads STALE with AUDIT_SUPERSEDED after a newer audit', async () => {
    const saved = await saveDefaultOption(app);
    supersedeAudit(world);

    const read = await readPlanAt(app, `/${String(dataOf(saved).id)}`);

    expect(latestFreshness(read)).toMatchObject({ state: 'STALE', reasons: ['AUDIT_SUPERSEDED'] });
  });

  acceptanceIt(
    'AC33',
    'reads STALE with SECTIONS_SUPERSEDED after a newer section snapshot',
    async () => {
      const saved = await saveDefaultOption(app);
      supersedeSections(world);

      const read = await readPlanAt(app, `/${String(dataOf(saved).id)}`);

      expect(latestFreshness(read)).toMatchObject({
        state: 'STALE',
        reasons: ['SECTIONS_SUPERSEDED'],
      });
    },
  );

  acceptanceIt(
    'AC33',
    'reads STALE with RULESET_CHANGED after the active ruleset version changes',
    async () => {
      const read = await savedPlanReadBy(rulesetChanged);

      expect(latestFreshness(read)).toMatchObject({
        state: 'STALE',
        reasons: ['RULESET_CHANGED'],
      });
    },
  );

  acceptanceIt(
    'AC33',
    'reads STALE with TRANSITION_TABLE_CHANGED after a newer transition table',
    async () => {
      const saved = await saveDefaultOption(app);
      supersedeTransitionTable(world);

      const read = await readPlanAt(app, `/${String(dataOf(saved).id)}`);

      expect(latestFreshness(read)).toMatchObject({
        state: 'STALE',
        reasons: ['TRANSITION_TABLE_CHANGED'],
      });
    },
  );

  acceptanceIt(
    'AC33',
    'reads STALE with SOURCE_EXPIRED one millisecond past the maximum age',
    async () => {
      const read = await savedPlanReadBy(pastMaxAge);

      expect(latestFreshness(read)).toMatchObject({
        state: 'STALE',
        reasons: ['SOURCE_EXPIRED'],
        checkedAt: '2026-09-02T05:00:00.001Z',
      });
    },
  );

  acceptanceIt('AC33', 'reads CURRENT with no reasons exactly at the maximum age', async () => {
    const read = await savedPlanReadBy(atMaxAge);

    expect(latestFreshness(read)).toEqual({
      state: 'CURRENT',
      reasons: [],
      checkedAt: '2026-09-02T05:00:00.000Z',
    });
  });

  acceptanceIt(
    'AC33',
    'returns a stale revision unchanged with its original createdAt and states',
    async () => {
      const saved = await saveDefaultOption(app);
      const planId = String(dataOf(saved).id);
      const before = await readPlanAt(app, `/${planId}/revisions/1`);
      supersedeSections(world);
      supersedeAudit(world);

      const after = await readPlanAt(pastMaxAge, `/${planId}/revisions/1`);

      expect(after.statusCode).toBe(200);
      expect(dataOf(after)).toMatchObject({
        revision: 1,
        createdAt: '2026-09-01T12:00:00.000Z',
        freshness: { state: 'STALE' },
      });
      expect(storedPartOf(after)).toEqual(storedPartOf(before));
    },
  );

  acceptanceIt('AC33', 'claims current validity nowhere in a STALE draft response', async () => {
    const saved = await saveDefaultOption(app);
    supersedeSections(world);

    const read = await readPlanAt(app, `/${String(dataOf(saved).id)}`);

    const { keys, strings } = keysAndStrings(read.body);
    expect(latestFreshness(read)).toMatchObject({ state: 'STALE' });
    expect(strings).not.toContain('CURRENT');
    expect(keys.filter((key) => /^(is)?(current|valid)(now|ity)?$/i.test(key))).toEqual([]);
  });

  acceptanceIt('AC33', 'claims current validity nowhere in an UNKNOWN draft response', async () => {
    const saved = await saveDefaultOption(app);
    world.sectionSnapshots = [];

    const read = await readPlanAt(app, `/${String(dataOf(saved).id)}`);

    const { keys, strings } = keysAndStrings(read.body);
    expect(latestFreshness(read)).toMatchObject({ state: 'UNKNOWN' });
    expect(strings).not.toContain('CURRENT');
    expect(keys.filter((key) => /^(is)?(current|valid)(now|ity)?$/i.test(key))).toEqual([]);
  });
});
