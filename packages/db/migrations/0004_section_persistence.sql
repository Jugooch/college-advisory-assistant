CREATE TABLE "campus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_campus_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campus_tenant_id_source_campus_id_key" UNIQUE("tenant_id","source_campus_id"),
	CONSTRAINT "campus_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "campus_text_not_empty" CHECK (length("campus"."source_campus_id") > 0 AND length("campus"."name") > 0)
);
--> statement-breakpoint
CREATE TABLE "campus_transition" (
	"tenant_id" uuid NOT NULL,
	"version" text NOT NULL,
	"from_campus_id" uuid NOT NULL,
	"to_campus_id" uuid NOT NULL,
	"minutes" integer NOT NULL,
	CONSTRAINT "campus_transition_pkey" PRIMARY KEY("tenant_id","version","from_campus_id","to_campus_id"),
	CONSTRAINT "campus_transition_different_campuses" CHECK ("campus_transition"."from_campus_id" <> "campus_transition"."to_campus_id"),
	CONSTRAINT "campus_transition_minutes_nonnegative" CHECK ("campus_transition"."minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "campus_transition_version" (
	"tenant_id" uuid NOT NULL,
	"version" text NOT NULL,
	"published_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "campus_transition_version_pkey" PRIMARY KEY("tenant_id","version"),
	CONSTRAINT "campus_transition_version_published_key" UNIQUE("tenant_id","published_at"),
	CONSTRAINT "campus_transition_version_not_empty" CHECK (length("campus_transition_version"."version") > 0)
);
--> statement-breakpoint
CREATE TABLE "section_link_component" (
	"tenant_id" uuid NOT NULL,
	"section_snapshot_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"course_id" uuid NOT NULL,
	CONSTRAINT "section_link_component_pkey" PRIMARY KEY("tenant_id","group_id","position"),
	CONSTRAINT "section_link_component_course_key" UNIQUE("tenant_id","section_snapshot_id","group_id","position","course_id"),
	CONSTRAINT "section_link_component_position_nonnegative" CHECK ("section_link_component"."position" >= 0),
	CONSTRAINT "section_link_component_name_not_empty" CHECK (length("section_link_component"."name") > 0)
);
--> statement-breakpoint
CREATE TABLE "section_link_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"section_snapshot_id" uuid NOT NULL,
	"primary_section_id" uuid NOT NULL,
	CONSTRAINT "section_link_group_tenant_id_section_snapshot_id_id_key" UNIQUE("tenant_id","section_snapshot_id","id"),
	CONSTRAINT "section_link_group_primary_key" UNIQUE("tenant_id","section_snapshot_id","primary_section_id")
);
--> statement-breakpoint
CREATE TABLE "section_link_member" (
	"tenant_id" uuid NOT NULL,
	"section_snapshot_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"component_position" integer NOT NULL,
	"course_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "section_link_member_pkey" PRIMARY KEY("tenant_id","group_id","section_id"),
	CONSTRAINT "section_link_member_position_key" UNIQUE("tenant_id","group_id","component_position","position"),
	CONSTRAINT "section_link_member_position_nonnegative" CHECK ("section_link_member"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "section_meeting" (
	"tenant_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"weekdays" text[],
	"start_time" time(0),
	"end_time" time(0),
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"excluded_dates" date[] NOT NULL,
	"location_kind" text,
	"location_campus_id" uuid,
	"room" text,
	CONSTRAINT "section_meeting_pkey" PRIMARY KEY("tenant_id","section_id","position"),
	CONSTRAINT "section_meeting_position_nonnegative" CHECK ("section_meeting"."position" >= 0),
	CONSTRAINT "section_meeting_weekdays_known" CHECK ("section_meeting"."weekdays" IS NULL OR (cardinality("section_meeting"."weekdays") > 0
        AND "section_meeting"."weekdays" <@ ARRAY['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY',
          'SATURDAY', 'SUNDAY']::text[])),
	CONSTRAINT "section_meeting_time_range" CHECK (("section_meeting"."start_time" IS NULL AND "section_meeting"."end_time" IS NULL)
        OR ("section_meeting"."start_time" IS NOT NULL AND "section_meeting"."end_time" IS NOT NULL
          AND "section_meeting"."start_time" < "section_meeting"."end_time")),
	CONSTRAINT "section_meeting_date_range" CHECK ("section_meeting"."starts_on" <= "section_meeting"."ends_on"),
	CONSTRAINT "section_meeting_location_shape" CHECK (("section_meeting"."location_kind" = 'ON_CAMPUS' AND "section_meeting"."location_campus_id" IS NOT NULL)
        OR ("section_meeting"."location_kind" = 'ONLINE' AND "section_meeting"."location_campus_id" IS NULL
          AND "section_meeting"."room" IS NULL)
        OR ("section_meeting"."location_kind" IS NULL AND "section_meeting"."location_campus_id" IS NULL
          AND "section_meeting"."room" IS NULL)),
	CONSTRAINT "section_meeting_room_not_empty" CHECK ("section_meeting"."room" IS NULL OR length("section_meeting"."room") > 0)
);
--> statement-breakpoint
CREATE TABLE "section_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"term_starts_on" date NOT NULL,
	"term_ends_on" date NOT NULL,
	"timezone" text NOT NULL,
	"source_effective_at" timestamp (3) with time zone NOT NULL,
	"ingested_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "section_snapshot_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "section_snapshot_tenant_id_id_term_id_key" UNIQUE("tenant_id","id","term_id"),
	CONSTRAINT "section_snapshot_term_date_range" CHECK ("section_snapshot"."term_starts_on" <= "section_snapshot"."term_ends_on"),
	CONSTRAINT "section_snapshot_timezone_not_empty" CHECK (length("section_snapshot"."timezone") > 0)
);
--> statement-breakpoint
CREATE TABLE "section" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"section_snapshot_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"source_section_id" text NOT NULL,
	"section_code" text NOT NULL,
	"campus_id" uuid,
	"modality" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	CONSTRAINT "section_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "section_tenant_id_section_snapshot_id_id_course_id_key" UNIQUE("tenant_id","section_snapshot_id","id","course_id"),
	CONSTRAINT "section_tenant_id_section_snapshot_id_id_key" UNIQUE("tenant_id","section_snapshot_id","id"),
	CONSTRAINT "section_source_section_key" UNIQUE("tenant_id","section_snapshot_id","source_section_id"),
	CONSTRAINT "section_text_not_empty" CHECK (length("section"."source_section_id") > 0 AND length("section"."section_code") > 0),
	CONSTRAINT "section_date_range" CHECK ("section"."starts_on" <= "section"."ends_on"),
	CONSTRAINT "section_modality_known" CHECK ("section"."modality" IN ('IN_PERSON', 'HYBRID', 'ONLINE_SYNCHRONOUS', 'ONLINE_ASYNCHRONOUS')),
	CONSTRAINT "section_in_person_has_campus" CHECK ("section"."campus_id" IS NOT NULL OR "section"."modality" NOT IN ('IN_PERSON', 'HYBRID'))
);
--> statement-breakpoint
ALTER TABLE "campus" ADD CONSTRAINT "campus_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_transition" ADD CONSTRAINT "campus_transition_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_transition" ADD CONSTRAINT "campus_transition_version_fk" FOREIGN KEY ("tenant_id","version") REFERENCES "public"."campus_transition_version"("tenant_id","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_transition" ADD CONSTRAINT "campus_transition_from_campus_fk" FOREIGN KEY ("tenant_id","from_campus_id") REFERENCES "public"."campus"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_transition" ADD CONSTRAINT "campus_transition_to_campus_fk" FOREIGN KEY ("tenant_id","to_campus_id") REFERENCES "public"."campus"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_transition_version" ADD CONSTRAINT "campus_transition_version_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_link_component" ADD CONSTRAINT "section_link_component_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_link_component" ADD CONSTRAINT "section_link_component_group_fk" FOREIGN KEY ("tenant_id","section_snapshot_id","group_id") REFERENCES "public"."section_link_group"("tenant_id","section_snapshot_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_link_component" ADD CONSTRAINT "section_link_component_course_fk" FOREIGN KEY ("tenant_id","course_id") REFERENCES "public"."course"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_link_group" ADD CONSTRAINT "section_link_group_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_link_group" ADD CONSTRAINT "section_link_group_primary_fk" FOREIGN KEY ("tenant_id","section_snapshot_id","primary_section_id") REFERENCES "public"."section"("tenant_id","section_snapshot_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_link_member" ADD CONSTRAINT "section_link_member_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_link_member" ADD CONSTRAINT "section_link_member_component_fk" FOREIGN KEY ("tenant_id","section_snapshot_id","group_id","component_position","course_id") REFERENCES "public"."section_link_component"("tenant_id","section_snapshot_id","group_id","position","course_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_link_member" ADD CONSTRAINT "section_link_member_section_fk" FOREIGN KEY ("tenant_id","section_snapshot_id","section_id","course_id") REFERENCES "public"."section"("tenant_id","section_snapshot_id","id","course_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_meeting" ADD CONSTRAINT "section_meeting_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_meeting" ADD CONSTRAINT "section_meeting_section_fk" FOREIGN KEY ("tenant_id","section_id") REFERENCES "public"."section"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_meeting" ADD CONSTRAINT "section_meeting_campus_fk" FOREIGN KEY ("tenant_id","location_campus_id") REFERENCES "public"."campus"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_snapshot" ADD CONSTRAINT "section_snapshot_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_snapshot" ADD CONSTRAINT "section_snapshot_term_fk" FOREIGN KEY ("tenant_id","term_id") REFERENCES "public"."term"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section" ADD CONSTRAINT "section_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section" ADD CONSTRAINT "section_snapshot_fk" FOREIGN KEY ("tenant_id","section_snapshot_id","term_id") REFERENCES "public"."section_snapshot"("tenant_id","id","term_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section" ADD CONSTRAINT "section_course_fk" FOREIGN KEY ("tenant_id","course_id") REFERENCES "public"."course"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section" ADD CONSTRAINT "section_campus_fk" FOREIGN KEY ("tenant_id","campus_id") REFERENCES "public"."campus"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "section_snapshot_latest_idx" ON "section_snapshot" USING btree ("tenant_id","term_id","source_effective_at");--> statement-breakpoint
-- Hand-written addition, before merge (#215, NFR-01): published section snapshots and
-- transition table versions are immutable. They reuse reject_published_row_change() from
-- 0003_immutable_published_rules (#116): UPDATE and DELETE per row, TRUNCATE per statement.
-- `campus` stays mutable: it is reference data, and its keys protect every row that uses it.
CREATE TRIGGER "section_snapshot_immutable_row" BEFORE UPDATE OR DELETE ON "section_snapshot" FOR EACH ROW EXECUTE FUNCTION "reject_published_row_change"();--> statement-breakpoint
CREATE TRIGGER "section_snapshot_immutable_truncate" BEFORE TRUNCATE ON "section_snapshot" FOR EACH STATEMENT EXECUTE FUNCTION "reject_published_row_change"();--> statement-breakpoint
CREATE TRIGGER "section_immutable_row" BEFORE UPDATE OR DELETE ON "section" FOR EACH ROW EXECUTE FUNCTION "reject_published_row_change"();--> statement-breakpoint
CREATE TRIGGER "section_immutable_truncate" BEFORE TRUNCATE ON "section" FOR EACH STATEMENT EXECUTE FUNCTION "reject_published_row_change"();--> statement-breakpoint
CREATE TRIGGER "section_meeting_immutable_row" BEFORE UPDATE OR DELETE ON "section_meeting" FOR EACH ROW EXECUTE FUNCTION "reject_published_row_change"();--> statement-breakpoint
CREATE TRIGGER "section_meeting_immutable_truncate" BEFORE TRUNCATE ON "section_meeting" FOR EACH STATEMENT EXECUTE FUNCTION "reject_published_row_change"();--> statement-breakpoint
CREATE TRIGGER "section_link_group_immutable_row" BEFORE UPDATE OR DELETE ON "section_link_group" FOR EACH ROW EXECUTE FUNCTION "reject_published_row_change"();--> statement-breakpoint
CREATE TRIGGER "section_link_group_immutable_truncate" BEFORE TRUNCATE ON "section_link_group" FOR EACH STATEMENT EXECUTE FUNCTION "reject_published_row_change"();--> statement-breakpoint
CREATE TRIGGER "section_link_component_immutable_row" BEFORE UPDATE OR DELETE ON "section_link_component" FOR EACH ROW EXECUTE FUNCTION "reject_published_row_change"();--> statement-breakpoint
CREATE TRIGGER "section_link_component_immutable_truncate" BEFORE TRUNCATE ON "section_link_component" FOR EACH STATEMENT EXECUTE FUNCTION "reject_published_row_change"();--> statement-breakpoint
CREATE TRIGGER "section_link_member_immutable_row" BEFORE UPDATE OR DELETE ON "section_link_member" FOR EACH ROW EXECUTE FUNCTION "reject_published_row_change"();--> statement-breakpoint
CREATE TRIGGER "section_link_member_immutable_truncate" BEFORE TRUNCATE ON "section_link_member" FOR EACH STATEMENT EXECUTE FUNCTION "reject_published_row_change"();--> statement-breakpoint
CREATE TRIGGER "campus_transition_version_immutable_row" BEFORE UPDATE OR DELETE ON "campus_transition_version" FOR EACH ROW EXECUTE FUNCTION "reject_published_row_change"();--> statement-breakpoint
CREATE TRIGGER "campus_transition_version_immutable_truncate" BEFORE TRUNCATE ON "campus_transition_version" FOR EACH STATEMENT EXECUTE FUNCTION "reject_published_row_change"();--> statement-breakpoint
CREATE TRIGGER "campus_transition_immutable_row" BEFORE UPDATE OR DELETE ON "campus_transition" FOR EACH ROW EXECUTE FUNCTION "reject_published_row_change"();--> statement-breakpoint
CREATE TRIGGER "campus_transition_immutable_truncate" BEFORE TRUNCATE ON "campus_transition" FOR EACH STATEMENT EXECUTE FUNCTION "reject_published_row_change"();