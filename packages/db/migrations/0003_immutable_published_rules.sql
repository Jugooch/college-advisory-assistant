-- Hand-written migration (#116, NFR-01). Published rules and policy are immutable per
-- ruleset_version: a change is a new version, so a pinned rulesetVersion always reproduces the
-- same result. The repositories expose no update methods; these triggers make the database
-- refuse UPDATE, DELETE and TRUNCATE as well. INSERT of a new version is unaffected.
--
-- reject_published_row_change() is table-agnostic. Other published, versioned tables (for
-- example section snapshots, #215) attach it with the same three triggers.
CREATE FUNCTION "reject_published_row_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'published rows of % are immutable; publish a new version instead', TG_TABLE_NAME
		USING ERRCODE = 'restrict_violation', TABLE = TG_TABLE_NAME, SCHEMA = TG_TABLE_SCHEMA;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "prerequisite_rule_immutable_row"
	BEFORE UPDATE OR DELETE ON "prerequisite_rule"
	FOR EACH ROW EXECUTE FUNCTION "reject_published_row_change"();
--> statement-breakpoint
CREATE TRIGGER "prerequisite_rule_immutable_truncate"
	BEFORE TRUNCATE ON "prerequisite_rule"
	FOR EACH STATEMENT EXECUTE FUNCTION "reject_published_row_change"();
--> statement-breakpoint
CREATE TRIGGER "academic_policy_immutable_row"
	BEFORE UPDATE OR DELETE ON "academic_policy"
	FOR EACH ROW EXECUTE FUNCTION "reject_published_row_change"();
--> statement-breakpoint
CREATE TRIGGER "academic_policy_immutable_truncate"
	BEFORE TRUNCATE ON "academic_policy"
	FOR EACH STATEMENT EXECUTE FUNCTION "reject_published_row_change"();
