/**
 * @file Roles a user can hold within one institution.
 * @module @caa/domain/enums/role
 * @requirement FR-02
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

/** Role a user holds within one institution. Authorization combines role, assignment, and tenant. */
export const Role = {
  Student: 'STUDENT',
  Advisor: 'ADVISOR',
  Admin: 'ADMIN',
} as const;

/** Union of every {@link Role} value. */
export type Role = (typeof Role)[keyof typeof Role];

/** Runtime schema for {@link Role}. */
export const RoleSchema = z.enum(Role);
