/**
 * @file Approved policy document data object: one revision of institution-approved text.
 * @module @caa/domain/models/policy-document
 * @requirement FR-16
 * @see docs/adr/0015-conversation-orchestration-and-policy-corpus.md
 */
import { z } from 'zod';

import {
  PolicyApprovalStatus,
  PolicyApprovalStatusSchema,
} from '../enums/policy-approval-status.enum';
import { PolicyAudienceSchema } from '../enums/policy-audience.enum';
import { PolicyTopicSchema } from '../enums/policy-topic.enum';
import { InstitutionIdSchema } from './institution.model';

/** Branded ID so a policy document ID can never be passed where another ID is expected. */
export const PolicyDocumentIdSchema = z.uuid().brand<'PolicyDocumentId'>();

/** Unique identifier of a {@link PolicyDocument}. */
export type PolicyDocumentId = z.infer<typeof PolicyDocumentIdSchema>;

/** Schema for one revision of a policy document. Applicability is the repository's job. */
export const PolicyDocumentSchema = z
  .object({
    id: PolicyDocumentIdSchema,
    tenantId: InstitutionIdSchema,
    /** Stable key shared by every revision of the same document. */
    documentKey: z.string().min(1).max(100),
    /** Revision number, starting at 1. */
    revision: z.number().int().min(1),
    title: z.string().min(1).max(200),
    /** Approved text. Untrusted when it reaches a model (planning/10). */
    body: z.string().min(1).max(20000),
    topic: PolicyTopicSchema,
    /** Subject the document speaks to; two current documents with one subject may conflict. */
    subjectKey: z.string().min(1).max(100),
    audience: PolicyAudienceSchema,
    /** Start of applicability. ISO 8601 with offset. */
    effectiveFrom: z.iso.datetime({ offset: true }),
    /** End of applicability, exclusive. ISO 8601 with offset, or `null` when open-ended. */
    effectiveTo: z.iso.datetime({ offset: true }).nullable(),
    approvalStatus: PolicyApprovalStatusSchema,
    /** When the revision was approved. Present exactly when the status is APPROVED. */
    approvedAt: z.iso.datetime({ offset: true }).nullable(),
    /** Human-readable origin shown with the text. */
    sourceLabel: z.string().min(1).max(200),
    /** Hash of the content, as `sha256:` plus 64 lowercase hex characters. */
    contentHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  })
  // SAFETY: an interval that is empty or reversed would never apply, or apply wrongly.
  // NOTE: compared as instants, because strings with different offsets don't sort lexically.
  .refine(
    (doc) =>
      doc.effectiveTo === null || Date.parse(doc.effectiveTo) > Date.parse(doc.effectiveFrom),
    { message: 'effectiveTo must be later than effectiveFrom', path: ['effectiveTo'] },
  )
  // SAFETY: a revision is approved exactly when it carries an approval time, so an
  // unapproved text can't look approved and an approved one can't lack its record.
  .refine(
    (doc) => (doc.approvalStatus === PolicyApprovalStatus.Approved) === (doc.approvedAt !== null),
    {
      message: 'approvedAt is required exactly when approvalStatus is APPROVED',
      path: ['approvedAt'],
    },
  )
  .readonly();

/** A validated, immutable policy document revision. */
export type PolicyDocument = z.infer<typeof PolicyDocumentSchema>;

/** Raw input accepted by {@link createPolicyDocument}. */
export type PolicyDocumentInput = z.input<typeof PolicyDocumentSchema>;

/**
 * Creates a validated, immutable policy document.
 *
 * @param input - Raw policy document fields.
 * @returns The parsed policy document.
 * @throws {z.ZodError} When a field is invalid, the interval is empty, or `approvedAt` does not
 *   match the approval status.
 */
export function createPolicyDocument(input: PolicyDocumentInput): PolicyDocument {
  return PolicyDocumentSchema.parse(input);
}
