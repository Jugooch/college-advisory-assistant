/**
 * @file Fails when the API's in-memory seed scenarios drift from what the dev seed writes (#147).
 * The fixtures can't import `@caa/db/testing` themselves (it is for test files only), so this test
 * compares them with the seed's own plan instead.
 * @requirement FR-09
 * @see packages/db/src/seed/dev-seed-academic-plan.ts
 */
import { describe, expect, it } from 'vitest';

import { buildDevSeedPlan } from '@caa/db/testing';
import type { AuditSnapshot, StudentSnapshot } from '@caa/domain';

import type { InMemoryAcademicStore } from './in-memory-academic-repositories';
import { buildSeedAcademicStore, SEED_RULESET, SEED_STUDENTS } from './seed-scenario-fixtures';

/**
 * The seed run the fixtures copy. The seed times every record relative to its run, and this run
 * puts SYN-000001's record at 2026-09-01T05:00Z, 7 hours before the API tests' clock.
 */
const SEED_RUN_AT = new Date('2026-09-01T08:00:00.000Z');

const plan = buildDevSeedPlan(SEED_RUN_AT);

/**
 * Replaces what legitimately differs between a seed run and the fixtures: each run mints new
 * snapshot and audit IDs and suffixes audit versions with the run time. References between
 * records are kept, as positions in the store.
 *
 * @param store - The records to compare.
 * @param store.studentSnapshots - Snapshots, in store order.
 * @param store.audits - Audits, in store order.
 * @returns The snapshots and audits with run-specific values replaced.
 */
function withoutRunIds(store: {
  readonly studentSnapshots: readonly StudentSnapshot[];
  readonly audits: readonly AuditSnapshot[];
}) {
  const snapshotRef = new Map(
    store.studentSnapshots.map((snapshot, index) => [snapshot.id, `snapshot-${String(index)}`]),
  );
  return {
    studentSnapshots: store.studentSnapshots.map((snapshot) => ({
      ...snapshot,
      id: snapshotRef.get(snapshot.id),
    })),
    audits: store.audits.map((audit, index) => ({
      ...audit,
      id: `audit-${String(index)}`,
      studentSnapshotId: snapshotRef.get(audit.studentSnapshotId),
      auditVersion: audit.auditVersion.replace(/_\d+$/, ''),
    })),
  };
}

/**
 * Reads a fixture store's run-specific records, failing if one is missing.
 *
 * @param store - The fixture store.
 * @returns Its snapshots and audits.
 */
function runRecords(store: InMemoryAcademicStore) {
  return { studentSnapshots: store.studentSnapshots ?? [], audits: store.audits ?? [] };
}

describe('seed-scenario fixtures', () => {
  const fixtures = buildSeedAcademicStore();

  it('hold the seed catalog, rules, policy, terms, and attempts exactly', () => {
    expect({
      courses: fixtures.courses,
      rules: fixtures.rules,
      policies: fixtures.policies,
      terms: fixtures.terms,
      attempts: fixtures.attempts,
    }).toEqual({
      courses: plan.academic.courses,
      rules: plan.academic.rules,
      policies: [plan.academic.policy],
      terms: plan.academic.terms,
      attempts: plan.academic.attempts,
    });
    expect(SEED_RULESET).toBe(plan.academic.policy.rulesetVersion);
  });

  it('hold the seed snapshots and audits, apart from per-run IDs and versions', () => {
    expect(withoutRunIds(runRecords(fixtures))).toEqual(
      withoutRunIds({ studentSnapshots: plan.academic.snapshots, audits: plan.academic.audits }),
    );
  });

  it('use the seed students SYN-000001 and SYN-000002', () => {
    const seeded = plan.students.map(({ id, tenantId, sourceStudentId }) => ({
      id,
      tenantId,
      sourceStudentId,
    }));

    expect(seeded).toEqual(
      expect.arrayContaining(
        Object.values(SEED_STUDENTS).map(({ id, tenantId, sourceStudentId }) => ({
          id,
          tenantId,
          sourceStudentId,
        })),
      ),
    );
  });
});
