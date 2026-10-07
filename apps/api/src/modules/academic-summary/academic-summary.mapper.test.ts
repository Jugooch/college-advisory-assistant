/**
 * @file Tests that the academic summary shows the stored course titles and program names, and
 * that `null` still means unknown (never a guessed or derived name).
 * @requirement FR-10
 * @requirement NFR-02
 */
import { describe, expect, it } from 'vitest';

import { createProgram, type Program } from '@caa/domain';
import { buildActor, buildStudent, SYNTHETIC_COURSES, SYNTHETIC_TENANTS } from '@caa/test-kit';

import { buildRecordAudit, buildRecordSnapshot } from '../../testing/academic-fixtures';
import { TEST_NOW } from '../../testing/fixtures';
import {
  createInMemoryRepositories,
  createRecordingLogger,
} from '../../testing/in-memory-repositories';
import { createPinnedRecordsService } from '../pinned-records/pinned-records.service';
import { toAcademicSummaryResponse } from './academic-summary.mapper';
import { createAcademicSummaryService } from './academic-summary.service';

const actor = buildActor();
const student = buildStudent({ userId: actor.userId });
const snapshot = buildRecordSnapshot();
const audit = buildRecordAudit();
const TITLED = { ...SYNTHETIC_COURSES.math102, title: 'Demo Calculus II' };

/**
 * Builds a program with the snapshot's and audit's ID.
 *
 * @param overrides - Fields to replace in the default.
 * @returns The program.
 */
function programOf(overrides: Partial<Parameters<typeof createProgram>[0]> = {}): Program {
  return createProgram({
    id: snapshot.programId ?? '',
    tenantId: SYNTHETIC_TENANTS.a.id,
    sourceProgramId: 'DEMO-BS-PHYS',
    name: 'Demo B.S. Physics',
    ...overrides,
  });
}

/**
 * Reads the summary as the response body, over a catalog of the titled course.
 *
 * @param programs - The program catalog.
 * @returns The response body.
 */
async function readResponse(programs: readonly Program[]) {
  const store = createInMemoryRepositories({
    identities: [],
    students: [student],
    assignments: [],
    studentSnapshots: [snapshot],
    audits: [audit],
    courses: [TITLED],
    programs,
  });
  const service = createAcademicSummaryService({
    students: { getStudent: () => Promise.resolve(student) },
    pinnedRecords: createPinnedRecordsService({
      studentSnapshots: store.studentSnapshots,
      auditSnapshots: store.auditSnapshots,
      now: () => new Date(TEST_NOW),
      maxSourceAgeMs: 86_400_000,
    }),
    maxSkewMs: 3_600_000,
    courseCatalog: store.courseCatalog,
    programs: store.programs,
  });
  const summary = await service.getAcademicSummary(actor, student.id, {
    logger: createRecordingLogger(),
  });
  return toAcademicSummaryResponse(summary);
}

describe('academic summary names', () => {
  it('sends the stored course title and program name', async () => {
    const response = await readResponse([programOf()]);

    expect(response.studentSnapshot.programName).toBe('Demo B.S. Physics');
    expect(response.audit?.programName).toBe('Demo B.S. Physics');
    expect(response.courses[0]?.title).toBe('Demo Calculus II');
  });

  it('sends null when the catalog states no program name', async () => {
    const response = await readResponse([programOf({ name: null })]);

    expect(response.studentSnapshot.programName).toBeNull();
    expect(response.audit?.programName).toBeNull();
  });

  it('sends null when the program is not in the catalog, never its source ID', async () => {
    const response = await readResponse([]);

    expect(response.studentSnapshot.programName).toBeNull();
  });

  it("sends no program name from another tenant's catalog", async () => {
    const response = await readResponse([programOf({ tenantId: SYNTHETIC_TENANTS.b.id })]);

    expect(response.studentSnapshot.programName).toBeNull();
    expect(response.audit?.programName).toBeNull();
  });
});
