-- Hand-written migration (#406, NFR-01, ADR-0013 §1). A plan revision is never rewritten:
-- a change is a new revision. The repository exposes no update or delete method; these
-- triggers make the database refuse UPDATE, DELETE and TRUNCATE as well. INSERT of the next
-- revision is unaffected. Reuses reject_published_row_change() from migration 0003.
CREATE TRIGGER "plan_revision_immutable_row"
	BEFORE UPDATE OR DELETE ON "plan_revision"
	FOR EACH ROW EXECUTE FUNCTION "reject_published_row_change"();
--> statement-breakpoint
CREATE TRIGGER "plan_revision_immutable_truncate"
	BEFORE TRUNCATE ON "plan_revision"
	FOR EACH STATEMENT EXECUTE FUNCTION "reject_published_row_change"();
