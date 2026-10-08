-- Migration for #546 (FR-16, ADR-0015 Amendment 2). The generated column and check change are
-- followed by a hand-written backfill and trigger. An approved policy revision may be retracted
-- once (APPROVED to WITHDRAWN, setting withdrawn_at); nothing else about it may change, and
-- WITHDRAWN is final. Drafts stay editable. The refusal matches reject_published_row_change()
-- from migration 0003 (SQLSTATE restrict_violation, same message shape).
ALTER TABLE "policy_document" DROP CONSTRAINT "policy_document_approved_at_matches_status";--> statement-breakpoint
ALTER TABLE "policy_document" ADD COLUMN "withdrawn_at" timestamp with time zone;--> statement-breakpoint
UPDATE "policy_document" SET "withdrawn_at" = "created_at" WHERE "approval_status" = 'WITHDRAWN';--> statement-breakpoint
ALTER TABLE "policy_document" ADD CONSTRAINT "policy_document_times_match_status" CHECK (("policy_document"."approval_status" = 'DRAFT' AND "policy_document"."approved_at" IS NULL AND "policy_document"."withdrawn_at" IS NULL)
      OR ("policy_document"."approval_status" = 'APPROVED' AND "policy_document"."approved_at" IS NOT NULL AND "policy_document"."withdrawn_at" IS NULL)
      OR ("policy_document"."approval_status" = 'WITHDRAWN' AND "policy_document"."withdrawn_at" IS NOT NULL));
--> statement-breakpoint
DROP TRIGGER "policy_document_approved_immutable_row" ON "policy_document";
--> statement-breakpoint
CREATE FUNCTION "reject_policy_document_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'UPDATE'
		AND OLD."approval_status" = 'APPROVED' AND NEW."approval_status" = 'WITHDRAWN'
		AND NEW."id" IS NOT DISTINCT FROM OLD."id"
		AND NEW."tenant_id" IS NOT DISTINCT FROM OLD."tenant_id"
		AND NEW."document_key" IS NOT DISTINCT FROM OLD."document_key"
		AND NEW."revision" IS NOT DISTINCT FROM OLD."revision"
		AND NEW."title" IS NOT DISTINCT FROM OLD."title"
		AND NEW."body" IS NOT DISTINCT FROM OLD."body"
		AND NEW."topic" IS NOT DISTINCT FROM OLD."topic"
		AND NEW."subject_key" IS NOT DISTINCT FROM OLD."subject_key"
		AND NEW."audience" IS NOT DISTINCT FROM OLD."audience"
		AND NEW."effective_from" IS NOT DISTINCT FROM OLD."effective_from"
		AND NEW."effective_to" IS NOT DISTINCT FROM OLD."effective_to"
		AND NEW."approved_at" IS NOT DISTINCT FROM OLD."approved_at"
		AND NEW."source_label" IS NOT DISTINCT FROM OLD."source_label"
		AND NEW."content_hash" IS NOT DISTINCT FROM OLD."content_hash"
		AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at"
	THEN
		RETURN NEW;
	END IF;
	RAISE EXCEPTION 'published rows of % are immutable; publish a new version instead', TG_TABLE_NAME
		USING ERRCODE = 'restrict_violation', TABLE = TG_TABLE_NAME, SCHEMA = TG_TABLE_SCHEMA;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "policy_document_approved_immutable_row"
	BEFORE UPDATE OR DELETE ON "policy_document"
	FOR EACH ROW WHEN (OLD."approval_status" IN ('APPROVED', 'WITHDRAWN'))
	EXECUTE FUNCTION "reject_policy_document_change"();
