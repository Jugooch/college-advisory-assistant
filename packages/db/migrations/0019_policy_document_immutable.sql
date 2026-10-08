-- Hand-written migration (#506, FR-16, ADR-0015 §6). An approved policy revision is immutable:
-- a change is a new revision. A draft may still be edited or approved, so the row triggers fire
-- only for rows that are APPROVED before the change. Reuses reject_published_row_change() from
-- migration 0003.
CREATE TRIGGER "policy_document_approved_immutable_row"
	BEFORE UPDATE OR DELETE ON "policy_document"
	FOR EACH ROW WHEN (OLD."approval_status" = 'APPROVED')
	EXECUTE FUNCTION "reject_published_row_change"();
--> statement-breakpoint
CREATE TRIGGER "policy_document_no_truncate"
	BEFORE TRUNCATE ON "policy_document"
	FOR EACH STATEMENT EXECUTE FUNCTION "reject_published_row_change"();
