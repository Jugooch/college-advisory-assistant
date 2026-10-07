-- Hand-written migration (#407, FR-12, NFR-01, ADR-0013 §6). Case events are append-only, and
-- a case row changes only to record its next event. The repository exposes no other write;
-- these triggers make the database refuse them too. Reuses reject_published_row_change() from
-- migration 0003.
CREATE TRIGGER "case_event_immutable_row"
	BEFORE UPDATE OR DELETE ON "case_event"
	FOR EACH ROW EXECUTE FUNCTION "reject_published_row_change"();
--> statement-breakpoint
CREATE TRIGGER "case_event_immutable_truncate"
	BEFORE TRUNCATE ON "case_event"
	FOR EACH STATEMENT EXECUTE FUNCTION "reject_published_row_change"();
--> statement-breakpoint
CREATE TRIGGER "advising_case_no_delete"
	BEFORE DELETE ON "advising_case"
	FOR EACH ROW EXECUTE FUNCTION "reject_published_row_change"();
--> statement-breakpoint
CREATE TRIGGER "advising_case_no_truncate"
	BEFORE TRUNCATE ON "advising_case"
	FOR EACH STATEMENT EXECUTE FUNCTION "reject_published_row_change"();
--> statement-breakpoint
-- Only status, owner and last_sequence may change, and last_sequence only to the next number.
CREATE FUNCTION "reject_case_identity_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF (NEW.id, NEW.tenant_id, NEW.student_id, NEW.reason, NEW.plan_revision_id, NEW.plan_id,
		NEW.discrepancy_subject, NEW.student_note, NEW.created_at)
		IS DISTINCT FROM
		(OLD.id, OLD.tenant_id, OLD.student_id, OLD.reason, OLD.plan_revision_id, OLD.plan_id,
		OLD.discrepancy_subject, OLD.student_note, OLD.created_at)
		OR NEW.last_sequence <> OLD.last_sequence + 1 THEN
		RAISE EXCEPTION 'only the status, owner and next sequence of % may change', TG_TABLE_NAME
			USING ERRCODE = 'restrict_violation', TABLE = TG_TABLE_NAME, SCHEMA = TG_TABLE_SCHEMA;
	END IF;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "advising_case_update_guard"
	BEFORE UPDATE ON "advising_case"
	FOR EACH ROW EXECUTE FUNCTION "reject_case_identity_change"();
--> statement-breakpoint
-- An event must describe the case's current state: its sequence is the case's last sequence and
-- its target status is the case's status, so the case row and its history can't disagree.
CREATE FUNCTION "require_event_matches_case"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	PERFORM 1 FROM "advising_case" c
		WHERE c.tenant_id = NEW.tenant_id AND c.id = NEW.case_id
			AND c.last_sequence = NEW.sequence AND c.status = NEW.to_status;
	IF NOT FOUND THEN
		RAISE EXCEPTION 'case event does not match its case state'
			USING ERRCODE = 'restrict_violation', TABLE = TG_TABLE_NAME, SCHEMA = TG_TABLE_SCHEMA;
	END IF;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "case_event_matches_case"
	BEFORE INSERT ON "case_event"
	FOR EACH ROW EXECUTE FUNCTION "require_event_matches_case"();
