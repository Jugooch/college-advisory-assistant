/**
 * @file Approval status of a policy document revision.
 * @module @caa/domain/enums/policy-approval-status
 * @requirement FR-16
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

/** Approval status of a policy revision. Only an approved revision can ever be shown. */
export const PolicyApprovalStatus = {
  Draft: 'DRAFT',
  Approved: 'APPROVED',
  Withdrawn: 'WITHDRAWN',
} as const;

/** Union of every {@link PolicyApprovalStatus} value. */
export type PolicyApprovalStatus = (typeof PolicyApprovalStatus)[keyof typeof PolicyApprovalStatus];

/** Runtime schema for {@link PolicyApprovalStatus}. */
export const PolicyApprovalStatusSchema = z.enum(PolicyApprovalStatus);
