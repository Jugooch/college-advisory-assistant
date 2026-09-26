/**
 * @file Lifecycle status of a user identity.
 * @module @caa/domain/enums/identity-status
 * @requirement FR-01
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import { z } from 'zod';

/** Whether a user identity may sign in. A disabled identity is denied even with a valid SSO session. */
export const IdentityStatus = {
  Active: 'ACTIVE',
  Disabled: 'DISABLED',
} as const;

/** Union of every {@link IdentityStatus} value. */
export type IdentityStatus = (typeof IdentityStatus)[keyof typeof IdentityStatus];

/** Runtime schema for {@link IdentityStatus}. */
export const IdentityStatusSchema = z.enum(IdentityStatus);
