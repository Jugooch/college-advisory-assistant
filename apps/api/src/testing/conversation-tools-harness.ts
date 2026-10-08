/**
 * @file Test harness for the conversation tools: synthetic actors, students and plans, the real
 * academic summary service over in-memory records, and recording fakes for the other services.
 * @module @caa/api/testing/conversation-tools-harness
 */
import { type Mock, vi } from 'vitest';

import type { ScheduleOptionsRequest } from '@caa/api-contract';
import { type Actor, Role, type StudentId } from '@caa/domain';
import {
  buildActor,
  buildPlanRevisionView,
  buildPlanView,
  buildPolicyHit,
  buildScheduleOptionsResponse,
  buildStudent,
  SYNTHETIC_TENANTS,
} from '@caa/test-kit';

import { createAcademicSummaryService } from '../modules/academic-summary/academic-summary.service';
import { createAccessService } from '../modules/access/access.service';
import { createToolRunners } from '../modules/conversation-tool-runners/conversation-tool-runners.service';
import type { ToolOutcome } from '../modules/conversation-tools/conversation-tools.logic';
import { createConversationToolsService } from '../modules/conversation-tools/conversation-tools.service';
import { createPinnedRecordsService } from '../modules/pinned-records/pinned-records.service';
import { NotFoundError } from '../shared/domain-errors';
import { buildRecordAudit, buildRecordSnapshot } from './academic-fixtures';
import { TEST_NOW } from './fixtures';
import { createInMemoryRepositories, createRecordingLogger } from './in-memory-repositories';

export /**
 *
 */
const studentActor = buildActor({ roles: [Role.Student] }, 1);
export /**
 *
 */
const otherTenantActor = buildActor({ tenantId: SYNTHETIC_TENANTS.b.id, roles: [Role.Student] }, 1);
export /**
 *
 */
const advisorActor = buildActor({ roles: [Role.Advisor] }, 2);
export /**
 *
 */
const ownStudent = buildStudent({ userId: studentActor.userId }, 1);
export /**
 *
 */
const otherStudent = buildStudent({}, 2);
export /**
 *
 */
const ownPlan = buildPlanView({}, 1);
export /**
 *
 */
const otherPlanId = buildPlanView({}, 9).id;
export /**
 *
 */
const toolContext = { logger: createRecordingLogger() };

/** How the record behaves. */
export interface ToolsSetupOptions {
  readonly missingRecord?: boolean;
  readonly staleRecord?: boolean;
}

/** What a test supplies besides the tool name and arguments. */
export interface RunInputs {
  readonly studentId?: StudentId;
  readonly plannerInputs?: ScheduleOptionsRequest | undefined;
  readonly actor?: Actor;
}

/** What {@link setupTools} returns. */
export interface ToolsHarness extends ReturnType<typeof buildFakes> {
  readonly run: (name: string, args: unknown, inputs?: RunInputs) => Promise<ToolOutcome>;
  readonly getAcademicSummary: Mock<
    (actor: Actor, studentId: StudentId, context: typeof toolContext) => Promise<unknown>
  >;
}

/**
 * Builds the recording fakes of the services other than the summary.
 *
 * @returns The fakes; plans resolve only for the student's own plan.
 */
function buildFakes() {
  const search = vi.fn(() =>
    Promise.resolve({
      hits: [buildPolicyHit({ title: 'Late registration', excerpt: 'Closes on day five.' })],
      asOf: '2026-09-22T15:00:00.000Z',
    }),
  );
  const findOptions = vi.fn((_actor: Actor, query: { studentId: StudentId }) =>
    Promise.resolve({ ...buildScheduleOptionsResponse(), asked: query.studentId }),
  );
  const getPlan = vi.fn((_actor: Actor, query: { studentId: StudentId; planId: string }) =>
    query.studentId === ownStudent.id && query.planId === ownPlan.id
      ? Promise.resolve(ownPlan)
      : Promise.reject(new NotFoundError()),
  );
  const getRevision = vi.fn(
    (_actor: Actor, query: { studentId: StudentId; planId: string; revision: number }) =>
      query.studentId === ownStudent.id && query.planId === ownPlan.id && query.revision === 1
        ? Promise.resolve(buildPlanRevisionView({ planId: ownPlan.id }))
        : Promise.reject(new NotFoundError()),
  );
  return { search, findOptions, getPlan, getRevision };
}

/**
 * Builds the tools service over synthetic records and recording fakes.
 *
 * @param options - Whether the record is missing or stale.
 * @returns A `run` helper and the fakes, to assert what was and was not called.
 */
export function setupTools(options: ToolsSetupOptions = {}): ToolsHarness {
  const rawStore = {
    identities: [],
    students: [ownStudent, otherStudent],
    assignments: [],
    studentSnapshots: options.missingRecord === true ? [] : [buildRecordSnapshot()],
    audits: [buildRecordAudit()],
  };
  const repositories = createInMemoryRepositories(rawStore);
  const summary = createAcademicSummaryService({
    students: { getStudent: () => Promise.resolve(ownStudent) },
    pinnedRecords: createPinnedRecordsService({
      studentSnapshots: repositories.studentSnapshots,
      auditSnapshots: repositories.auditSnapshots,
      now: () => new Date(options.staleRecord === true ? '2030-01-01T00:00:00.000Z' : TEST_NOW),
      maxSourceAgeMs: 86_400_000,
    }),
    maxSkewMs: 3_600_000,
    courseCatalog: repositories.courseCatalog,
    programs: repositories.programs,
  });
  const getAcademicSummary = vi.fn(
    (actor: Actor, studentId: StudentId, context: typeof toolContext) =>
      summary.getAcademicSummary(actor, studentId, context),
  );
  const { search, findOptions, getPlan, getRevision } = buildFakes();
  const service = createConversationToolsService({
    access: createAccessService({ ...repositories, now: () => new Date(TEST_NOW) }),
    runners: createToolRunners({
      academicSummary: { getAcademicSummary },
      policySearch: { search },
      scheduleOptions: { findOptions },
      planViews: { getPlan, getRevision },
    }),
  });
  const run = (name: string, args: unknown, inputs: RunInputs = {}) =>
    service.executeTool(
      inputs.actor ?? studentActor,
      {
        call: { id: 'call-1', name, arguments: args },
        studentId: inputs.studentId ?? ownStudent.id,
        plannerInputs: inputs.plannerInputs,
      },
      toolContext,
    );
  return { run, search, findOptions, getPlan, getRevision, getAcademicSummary };
}
