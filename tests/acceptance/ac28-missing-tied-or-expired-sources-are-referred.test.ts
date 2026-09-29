/**
 * @file Acceptance: missing, tied, or expired academic sources are referred, never guessed. No
 * record is 503 SOURCE_UNAVAILABLE; a tie for the latest record or audit is 409 STALE_SOURCE;
 * course checks need an audit and a policy; and a record or audit record time older than the
 * 24-hour maximum age refers both reads to an advisor with 409 STALE_SOURCE. There is no 200
 * historical view: every 200 is fresh (ADR-0008 and standard 05 §Source freshness, decided on
 * #114). Exactly at the limit is still fresh. Until #114 lands, the summary case is a known
 * finding (tests/support/known-findings.ts).
 * @requirement FR-04
 * @requirement NFR-01
 * @requirement NFR-04
 * @requirement T02
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 * @see docs/planning/07-system-architecture-and-design.md
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { SYNTHETIC_COURSES } from '@caa/test-kit';

import {
  buildAcademicApp,
  checkCourses,
  createAcademicWorld,
  readSummary,
  recordAudit,
  recordSnapshot,
  resetAcademicWorld,
} from '../support/academic-endpoints-harness';
import { type AcceptanceResponse, summarizeError } from '../support/api-harness';
import { acceptanceIt } from '../support/known-findings';

const MATH102_ONLY = { courseIds: [SYNTHETIC_COURSES.math102.id] };
const UNAVAILABLE = { statusCode: 503, bodyKeys: ['error'], code: 'SOURCE_UNAVAILABLE' };
const STALE = { statusCode: 409, bodyKeys: ['error'], code: 'STALE_SOURCE' };
/** Exactly 24 hours before the harness clock (2026-09-01T12:00Z). */
const AT_THE_LIMIT = '2026-08-31T12:00:00.000Z';
/** One millisecond older than {@link AT_THE_LIMIT}. */
const PAST_THE_LIMIT = '2026-08-31T11:59:59.999Z';

const world = createAcademicWorld();

// NOTE: built once at module scope, like AC15 and AC21, so Fastify's first build doesn't count
// against a case's timeout.
const app = buildAcademicApp(world);

/**
 * Reads both endpoints as the student.
 *
 * @returns The summary and course-check responses.
 */
async function readBoth(): Promise<readonly [AcceptanceResponse, AcceptanceResponse]> {
  return [await readSummary(app), await checkCourses(app, MATH102_ONLY)];
}

/**
 * Stores a record at the given time and the audit run against it, generated an hour later.
 *
 * @param recordAt - The record's source time.
 * @param auditRecordAt - The record time the audit reports; defaults to `recordAt`.
 */
function storeRecordAt(recordAt: string, auditRecordAt = recordAt): void {
  world.studentSnapshots = [
    recordSnapshot({ sourceEffectiveAt: recordAt, ingestedAt: '2026-09-01T06:30:00.000Z' }),
  ];
  world.audits = [
    recordAudit([{}], {
      studentRecordEffectiveAt: auditRecordAt,
      generatedAt: '2026-09-01T07:00:00.000Z',
    }),
  ];
}

describe('AC28 missing, tied, or expired sources are referred', () => {
  beforeEach(() => {
    resetAcademicWorld(world);
  });

  it('refers both reads with 503 SOURCE_UNAVAILABLE when there is no record', async () => {
    world.studentSnapshots = [];

    const [summary, checks] = await readBoth();

    expect(summarizeError(summary)).toMatchObject(UNAVAILABLE);
    expect(summarizeError(checks)).toMatchObject(UNAVAILABLE);
  });

  it('refers both reads with 409 STALE_SOURCE when two records tie for latest', async () => {
    world.studentSnapshots = [recordSnapshot({}, 1), recordSnapshot({}, 2)];

    const [summary, checks] = await readBoth();

    expect(summarizeError(summary)).toMatchObject(STALE);
    expect(summarizeError(checks)).toMatchObject(STALE);
  });

  it('refers both reads with 409 STALE_SOURCE when two audits tie for latest', async () => {
    world.audits = [
      recordAudit([{}], { id: '70000000-0000-4000-8000-000000000001' }),
      recordAudit([{}], { id: '70000000-0000-4000-8000-000000000002', auditVersion: 'r2' }),
    ];

    const [summary, checks] = await readBoth();

    expect(summarizeError(summary)).toMatchObject(STALE);
    expect(summarizeError(checks)).toMatchObject(STALE);
  });

  it('shows the record with no audit and no verdict when the student has no audit', async () => {
    world.audits = [];

    const summary = await readSummary(app);

    expect(summary).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          audit: null,
          auditReflectsRecord: null,
          programCatalogConsistency: null,
          requirements: [],
        },
      },
    });
  });

  it('refers course checks with 503 when the student has no audit', async () => {
    world.audits = [];

    const checks = await checkCourses(app, MATH102_ONLY);

    expect(summarizeError(checks)).toMatchObject(UNAVAILABLE);
  });

  it('refers course checks with 503 when the ruleset has no policy', async () => {
    world.policies = [];

    const checks = await checkCourses(app, MATH102_ONLY);

    expect(summarizeError(checks)).toMatchObject(UNAVAILABLE);
  });

  it('runs course checks on a record exactly 24 hours old', async () => {
    storeRecordAt(AT_THE_LIMIT);

    const checks = await checkCourses(app, MATH102_ONLY);

    expect(checks).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          pinnedInputs: {
            studentRecordEffectiveAt: '2026-08-31T12:00:00.000Z',
            auditRecordEffectiveAt: '2026-08-31T12:00:00.000Z',
          },
        },
      },
    });
  });

  it('refuses course checks with 409 on a record one millisecond past 24 hours', async () => {
    storeRecordAt(PAST_THE_LIMIT);

    const checks = await checkCourses(app, MATH102_ONLY);

    expect(summarizeError(checks)).toMatchObject(STALE);
  });

  it('refuses course checks with 409 when only the audit’s record time is past 24 hours', async () => {
    storeRecordAt('2026-09-01T06:00:00.000Z', PAST_THE_LIMIT);

    const checks = await checkCourses(app, MATH102_ONLY);

    expect(summarizeError(checks)).toMatchObject(STALE);
  });

  it('serves the summary on a record exactly 24 hours old', async () => {
    storeRecordAt(AT_THE_LIMIT);

    const summary = await readSummary(app);

    expect(summary).toMatchObject({
      statusCode: 200,
      body: { data: { studentSnapshot: { sourceEffectiveAt: '2026-08-31T12:00:00.000Z' } } },
    });
  });

  acceptanceIt(
    'AC28',
    'refers the summary to an advisor with 409 STALE_SOURCE past 24 hours',
    async () => {
      storeRecordAt(PAST_THE_LIMIT);

      const summary = summarizeError(await readSummary(app));

      expect(summary).toMatchObject(STALE);
      expect(String(summary.message)).toMatch(/advisor/i);
    },
  );
});
