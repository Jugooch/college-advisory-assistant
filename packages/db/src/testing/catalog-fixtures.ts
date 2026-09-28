/**
 * @file Synthetic catalog and term rows for repository integration tests. Test code only.
 * @module @caa/db/testing/catalog-fixtures
 * @see docs/standards/07-testing.md
 */
import {
  type CourseId,
  CourseIdSchema,
  type EquivalencyGroupId,
  EquivalencyGroupIdSchema,
  type InstitutionId,
  type TermId,
  TermIdSchema,
} from '@caa/domain';

import type { Database } from '../client';
import { courseTable } from '../tables/course.table';
import { equivalencyGroupTable } from '../tables/equivalency-group.table';
import { termTable } from '../tables/term.table';

/** Course columns a test may set; the rest default to a fixed 3-credit course. */
export type CourseFixture = Partial<Omit<typeof courseTable.$inferInsert, 'tenantId'>>;

/** Term columns a test sets; dates default to a fall term. */
export type TermFixture = Pick<typeof termTable.$inferInsert, 'termCode' | 'sequence'> &
  Partial<Pick<typeof termTable.$inferInsert, 'startsOn' | 'endsOn'>>;

/**
 * Describes a failed query caused by one named constraint, for `rejects.toMatchObject`, so a
 * test proves which key or check refused the write.
 *
 * @param constraint - Constraint name from the table definition.
 * @returns The partial error shape to match.
 */
export function violationOf(constraint: string): {
  readonly cause: { readonly constraint: string };
} {
  return { cause: { constraint } };
}

/**
 * Inserts a synthetic equivalency group.
 *
 * @param db - Database handle.
 * @param tenantId - Owning tenant.
 * @param sourceEquivalencyGroupId - Fictional source ID.
 * @returns The new group ID.
 */
export async function insertEquivalencyGroup(
  db: Database,
  tenantId: InstitutionId,
  sourceEquivalencyGroupId: string,
): Promise<EquivalencyGroupId> {
  const rows = await db
    .insert(equivalencyGroupTable)
    .values({ tenantId, sourceEquivalencyGroupId })
    .returning({ id: equivalencyGroupTable.id });
  return EquivalencyGroupIdSchema.parse(rows[0]?.id);
}

/**
 * Inserts a synthetic course.
 *
 * @param db - Database handle.
 * @param tenantId - Owning tenant.
 * @param fixture - Columns to change from a fixed 3-credit `DEMO-GEN-001`.
 * @returns The new course ID.
 */
export async function insertCourse(
  db: Database,
  tenantId: InstitutionId,
  fixture: CourseFixture = {},
): Promise<CourseId> {
  const rows = await db
    .insert(courseTable)
    .values({
      tenantId,
      sourceCourseId: 'DEMO-GEN-001',
      label: 'DEMO-GEN 001',
      creditsHundredths: 300,
      ...fixture,
    })
    .returning({ id: courseTable.id });
  return CourseIdSchema.parse(rows[0]?.id);
}

/**
 * Inserts a synthetic term.
 *
 * @param db - Database handle.
 * @param tenantId - Owning tenant.
 * @param fixture - Term code, sequence, and optional dates.
 * @returns The new term ID.
 */
export async function insertTerm(
  db: Database,
  tenantId: InstitutionId,
  fixture: TermFixture,
): Promise<TermId> {
  const rows = await db
    .insert(termTable)
    .values({ tenantId, startsOn: '2026-08-24', endsOn: '2026-12-18', ...fixture })
    .returning({ id: termTable.id });
  return TermIdSchema.parse(rows[0]?.id);
}
