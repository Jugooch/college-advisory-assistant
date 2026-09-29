/**
 * @file Table definition for versioned prerequisite rules.
 * @module @caa/db/tables/prerequisite-rule
 * @requirement FR-06
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { courseTable } from './course.table';
import { institutionTable } from './institution.table';

/**
 * The `prerequisite_rule` table. One row per course per published ruleset version. Published
 * rules are immutable: a change is a new `ruleset_version`, never an update. The database enforces
 * this: migration `0003_immutable_published_rules` rejects UPDATE, DELETE and TRUNCATE (NFR-01).
 */
export const prerequisiteRuleTable = pgTable(
  'prerequisite_rule',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => institutionTable.id),
    courseId: uuid('course_id').notNull(),
    rulesetVersion: text('ruleset_version').notNull(),
    // SAFETY: typed `unknown` on purpose, so nothing can read the tree without the mapper
    // parsing it through `PrerequisiteRuleSchema`. An invalid stored tree fails loudly.
    /** Prerequisite expression tree as JSON. */
    expression: jsonb('expression').notNull().$type<unknown>(),
    /** Reference to the source rule, shown as evidence. */
    sourceRef: text('source_ref').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('prerequisite_rule_tenant_id_course_id_ruleset_version_key').on(
      table.tenantId,
      table.courseId,
      table.rulesetVersion,
    ),
    // SECURITY: target of composite foreign keys, so references can't cross tenants.
    unique('prerequisite_rule_tenant_id_id_key').on(table.tenantId, table.id),
    // SECURITY: a rule can only state prerequisites for a course of its own tenant.
    foreignKey({
      name: 'prerequisite_rule_course_fk',
      columns: [table.tenantId, table.courseId],
      foreignColumns: [courseTable.tenantId, courseTable.id],
    }),
    check('prerequisite_rule_ruleset_version_not_empty', sql`length(${table.rulesetVersion}) > 0`),
    check('prerequisite_rule_source_ref_not_empty', sql`length(${table.sourceRef}) > 0`),
    check('prerequisite_rule_expression_object', sql`jsonb_typeof(${table.expression}) = 'object'`),
  ],
);

/** A row read from {@link prerequisiteRuleTable}. Never leaves this package. */
export type PrerequisiteRuleRow = typeof prerequisiteRuleTable.$inferSelect;
