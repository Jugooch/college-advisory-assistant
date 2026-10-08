-- Hand-written migration (#507, FR-14, NFR-08, ADR-0015 §7). A stored turn is never edited:
-- the repository exposes no update, and this trigger makes the database refuse one too.
-- DELETE stays allowed, because retention and clearing remove whole turns.
CREATE FUNCTION "reject_conversation_turn_update"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'turns of % are immutable; delete the turn instead', TG_TABLE_NAME
		USING ERRCODE = 'restrict_violation', TABLE = TG_TABLE_NAME, SCHEMA = TG_TABLE_SCHEMA;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "conversation_turn_no_update"
	BEFORE UPDATE ON "conversation_turn"
	FOR EACH ROW EXECUTE FUNCTION "reject_conversation_turn_update"();
