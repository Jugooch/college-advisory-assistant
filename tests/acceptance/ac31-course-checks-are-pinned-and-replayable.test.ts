/**
 * @file Acceptance: every course-check result names the inputs it was computed from (record
 * snapshot, audit, ruleset) and the as-of times, so it can be reproduced; replaying the same
 * request on the same inputs gives a deep-equal result; and neither endpoint carries free-text
 * academic claims: every consequential value is a structured field.
 * @requirement FR-09
 * @requirement FR-10
 * @requirement NFR-01
 * @requirement NFR-04
 * @see docs/planning/13-test-and-evaluation-strategy.md
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/10-ai-behavior-and-safety-contract.md
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { completedAttempt, SYNTHETIC_COURSES } from '@caa/test-kit';

import {
  buildAcademicApp,
  checkCourses,
  createAcademicWorld,
  readSummary,
  recordAudit,
  recordSnapshot,
  resetAcademicWorld,
} from '../support/academic-endpoints-harness';

const { math102, phys201, ind390 } = SYNTHETIC_COURSES;
const MATH101_B = completedAttempt();
/** Three courses, one contest, one rule-less course, and one unchosen variable credit. */
const MIXED_SET = { courseIds: [math102.id, phys201.id, ind390.id] };
/** A string with no whitespace: an ID, enum, version, reference, or timestamp, never prose. */
const TOKEN = /^\S+$/;

const world = createAcademicWorld();

// NOTE: built once at module scope, like AC15 and AC21, so Fastify's first build doesn't count
// against a case's timeout.
const app = buildAcademicApp(world);

/**
 * Lists every string in a JSON value with the key that holds it.
 *
 * @param value - Parsed JSON.
 * @param key - The key holding `value`; empty at the root and for array items' own key.
 * @returns `[key, string]` pairs in document order.
 */
function stringLeaves(value: unknown, key = ''): readonly (readonly [string, string])[] {
  if (typeof value === 'string') {
    return [[key, value]];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => stringLeaves(item, key));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([child, item]) => stringLeaves(item, child));
  }
  return [];
}

describe('AC31 course checks are pinned and replayable', () => {
  beforeEach(() => {
    resetAcademicWorld(world, {
      attempts: [MATH101_B],
      requirements: [{ candidateCourseIds: [math102.id, phys201.id], remainingCourseCount: 1 }],
    });
  });

  it('pins the record snapshot, audit, ruleset, and as-of times', async () => {
    const response = await checkCourses(app, { courseIds: [math102.id] });

    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        data: {
          pinnedInputs: {
            studentSnapshotId: 'a0000000-0000-4000-8000-000000000001',
            studentRecordEffectiveAt: '2026-09-01T06:00:00.000Z',
            auditRecordEffectiveAt: '2026-09-01T06:00:00.000Z',
            auditSource: 'demo-audit',
            auditVersion: 'audit_demo_r1',
            rulesetVersion: 'demo-2026.1',
          },
          courseResults: [{ prerequisite: { evidence: { rulesetVersion: 'demo-2026.1' } } }],
        },
      },
    });
  });

  it('pins the latest revision and keeps the audit’s own record time apart', async () => {
    world.studentSnapshots = [
      recordSnapshot({ attemptIds: [MATH101_B.id] }, 1),
      recordSnapshot(
        {
          attemptIds: [MATH101_B.id],
          sourceEffectiveAt: '2026-09-01T09:00:00.000Z',
          ingestedAt: '2026-09-01T09:05:00.000Z',
        },
        2,
      ),
    ];

    const response = await checkCourses(app, { courseIds: [math102.id] });

    expect(response).toMatchObject({
      body: {
        data: {
          pinnedInputs: {
            studentSnapshotId: 'a0000000-0000-4000-8000-000000000002',
            studentRecordEffectiveAt: '2026-09-01T09:00:00.000Z',
            auditRecordEffectiveAt: '2026-09-01T06:00:00.000Z',
          },
        },
      },
    });
  });

  it('pins the newer audit once one is stored', async () => {
    world.audits = [
      recordAudit(),
      recordAudit([{}], {
        id: '70000000-0000-4000-8000-000000000002',
        auditVersion: 'audit_demo_r2',
        generatedAt: '2026-09-01T08:00:00.000Z',
      }),
    ];

    const response = await checkCourses(app, { courseIds: [math102.id] });

    expect(response).toMatchObject({
      body: { data: { pinnedInputs: { auditVersion: 'audit_demo_r2' } } },
    });
  });

  it('gives a deep-equal course-check result when the same request is replayed', async () => {
    const first = await checkCourses(app, MIXED_SET);
    const replay = await checkCourses(app, MIXED_SET);

    expect(first.statusCode).toBe(200);
    expect(replay).toEqual(first);
  });

  it('gives a deep-equal academic summary when it is read again', async () => {
    const first = await readSummary(app);
    const replay = await readSummary(app);

    expect(first.statusCode).toBe(200);
    expect(replay).toEqual(first);
  });

  it('carries no free text in course checks: every string is a token', async () => {
    const response = await checkCourses(app, MIXED_SET);

    expect(response.statusCode).toBe(200);
    expect(stringLeaves(response.body).filter(([, text]) => !TOKEN.test(text))).toEqual([]);
  });

  it('carries no free text in the summary beyond the audit’s own requirement labels', async () => {
    const response = await readSummary(app);
    const prose = stringLeaves(response.body).filter(([, text]) => !TOKEN.test(text));

    expect(response.statusCode).toBe(200);
    expect(prose).toEqual([['label', 'Mathematics core']]);
  });
});
