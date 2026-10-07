/**
 * @file In-memory repository fakes for API tests. Test code only; never wired by the container.
 * @module @caa/api/testing/in-memory-repositories
 * @see docs/standards/07-testing.md
 */
import type { AdvisorAssignment, Student, UserIdentity } from '@caa/domain';

import type { Repositories } from '../container';
import type { Logger } from '../shared/logger';
import {
  createInMemoryAcademicRepositories,
  type InMemoryAcademicStore,
} from './in-memory-academic-repositories';
import {
  createInMemoryPlanRepository,
  type InMemoryPlanStore,
} from './in-memory-plan-repositories';
import {
  createInMemoryScheduleRepositories,
  type InMemoryScheduleStore,
} from './in-memory-schedule-repositories';

/** Mutable backing data, so a test can change it between two calls (for example to revoke). */
export interface InMemoryStore
  extends InMemoryAcademicStore, InMemoryScheduleStore, InMemoryPlanStore {
  identities: readonly UserIdentity[];
  students: readonly Student[];
  assignments: readonly AdvisorAssignment[];
}

/** One line written to a {@link RecordingLogger}. */
export interface LogEntry {
  readonly level: 'info' | 'warn';
  readonly details: Record<string, unknown>;
  readonly message: string;
}

/** Logger that keeps every line in memory for assertions. */
export interface RecordingLogger extends Logger {
  readonly entries: readonly LogEntry[];
}

/**
 * Creates repositories over an in-memory store with the same tenant and time-window rules as the
 * PostgreSQL repositories.
 *
 * @param store - Backing data. Read on every call.
 * @returns Every repository the container needs.
 */
export function createInMemoryRepositories(store: InMemoryStore): Repositories {
  return {
    userIdentities: {
      findByIssuerSubject: (issuer, subject) =>
        Promise.resolve(
          store.identities.find((item) => item.issuer === issuer && item.subject === subject) ??
            null,
        ),
    },
    students: {
      findById: (tenantId, id) =>
        Promise.resolve(
          store.students.find((item) => item.tenantId === tenantId && item.id === id) ?? null,
        ),
      findBySourceStudentId: (tenantId, sourceStudentId) =>
        Promise.resolve(
          store.students.find(
            (item) => item.tenantId === tenantId && item.sourceStudentId === sourceStudentId,
          ) ?? null,
        ),
    },
    studentUserLinks: {
      findByUserId: (tenantId, userId) => {
        const linked = store.students.filter(
          (item) => item.tenantId === tenantId && item.userId === userId,
        );
        // NOTE: the same refusal as the PostgreSQL repository: an ambiguous link picks no one.
        if (linked.length > 1) {
          return Promise.reject(new Error('More than one student is linked to the user'));
        }
        return Promise.resolve(linked[0] ?? null);
      },
    },
    ...createInMemoryAcademicRepositories(store),
    ...createInMemoryScheduleRepositories(store),
    plans: createInMemoryPlanRepository(store),
    advisorAssignments: {
      findActive: (tenantId, { advisorUserId, studentId, at }) => {
        const instant = Date.parse(at);
        const active = store.assignments.find(
          (item) =>
            item.tenantId === tenantId &&
            item.advisorUserId === advisorUserId &&
            item.studentId === studentId &&
            Date.parse(item.effectiveFrom) <= instant &&
            (item.effectiveTo === null || instant < Date.parse(item.effectiveTo)),
        );
        return Promise.resolve(active ?? null);
      },
    },
  };
}

/**
 * Creates a logger that records every line.
 *
 * @returns A {@link RecordingLogger}.
 */
export function createRecordingLogger(): RecordingLogger {
  const entries: LogEntry[] = [];
  return {
    entries,
    info: (details, message) => {
      entries.push({ level: 'info', details, message });
    },
    warn: (details, message) => {
      entries.push({ level: 'warn', details, message });
    },
  };
}
