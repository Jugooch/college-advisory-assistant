/**
 * @file drizzle-kit configuration for generating and applying migrations.
 */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://caa:caa@localhost:5432/caa' },
  strict: true,
});
