/**
 * @file Table definition for institutions (tenants).
 * @module @caa/db/tables/institution
 */
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** The `institution` table. Every other tenant-scoped table references it. */
export const institutionTable = pgTable('institution', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** A row read from {@link institutionTable}. Never leaves this package. */
export type InstitutionRow = typeof institutionTable.$inferSelect;
