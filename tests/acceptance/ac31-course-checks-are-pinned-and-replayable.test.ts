/**
 * @file Acceptance: every course-check result names the inputs it was computed from (record
 * snapshot, audit, ruleset) and the as-of times, so it can be reproduced; replaying the same
 * request on the same inputs gives a deep-equal result; and neither endpoint carries free-text
 * academic claims: every consequential value is a structured field. The only prose allowed is
 * plain catalog and audit data: each course's catalog code and title (#186), and the audit's own
 * requirement labels.
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
/**
 * The only places a response may carry catalog display text (#186): each course's catalog code,
 * such as `DEMO-MATH 102`, and its catalog title when the catalog has one. Both are plain catalog
 * data copied from the course, never a generated claim. Every other string stays a token.
 */
const CATALOG_DISPLAY_PATHS: readonly string[] = ['data.courses[].code', 'data.courses[].title'];

const world = createAcademicWorld();

// NOTE: built once at module scope, like AC15 and AC21, so Fastify's first build doesn't count
// against a case's timeout.
const app = buildAcademicApp(world);

/**
 * Lists every string in a JSON value with its path, for example `data.courses[].code`. Array
 * items share one path segment, `[]`.
 *
 * @param value - Parsed JSON.
 * @param path - The path of `value`; empty at the root.
 * @returns `[path, string]` pairs in document order.
 */
function stringLeaves(value: unknown, path = ''): readonly (readonly [string, string])[] {
  if (typeof value === 'string') {
    return [[path, value]];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => stringLeaves(item, `${path}[]`));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      stringLeaves(item, path === '' ? key : `${path}.${key}`),
    );
  }
  return [];
}

/**
 * Lists the strings in a response that read as prose: not a token, and not catalog display
 * text at one of {@link CATALOG_DISPLAY_PATHS}.
 *
 * @param body - The parsed response body.
 * @returns `[path, string]` pairs in document order.
 */
function proseOutsideCatalog(body: unknown): readonly (readonly [string, string])[] {
  return stringLeaves(body).filter(
    ([path, text]) => !TOKEN.test(text) && !CATALOG_DISPLAY_PATHS.includes(path),
  );
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

  it('carries no free text in course checks beyond catalog codes and titles', async () => {
    const response = await checkCourses(app, MIXED_SET);

    expect(response.statusCode).toBe(200);
    expect(proseOutsideCatalog(response.body)).toEqual([]);
  });

  it('carries no free text in the summary beyond requirement labels and catalog display', async () => {
    const response = await readSummary(app);

    expect(response.statusCode).toBe(200);
    expect(proseOutsideCatalog(response.body)).toEqual([
      ['data.requirements[].label', 'Mathematics core'],
    ]);
  });

  it('exempts only catalog codes and titles, not the same keys elsewhere', () => {
    const body = {
      data: {
        courses: [{ code: 'DEMO-MATH 102', title: 'Calculus II', credits: { kind: 'FIXED' } }],
        courseResults: [{ code: 'you are eligible', title: 'ready to register' }],
      },
    };

    expect(proseOutsideCatalog(body)).toEqual([
      ['data.courseResults[].code', 'you are eligible'],
      ['data.courseResults[].title', 'ready to register'],
    ]);
  });
});
