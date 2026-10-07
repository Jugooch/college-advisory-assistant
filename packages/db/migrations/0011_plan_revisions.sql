CREATE TABLE "plan_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"cause" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"course_ids" uuid[] NOT NULL,
	"credit_selections" jsonb NOT NULL,
	"constraints" jsonb NOT NULL,
	"student_snapshot_id" uuid NOT NULL,
	"student_record_effective_at" timestamp (3) with time zone NOT NULL,
	"audit_snapshot_id" uuid NOT NULL,
	"audit_record_effective_at" timestamp (3) with time zone NOT NULL,
	"audit_source" text NOT NULL,
	"audit_version" text NOT NULL,
	"ruleset_version" text NOT NULL,
	"section_snapshot_id" uuid NOT NULL,
	"campus_transition_version" text,
	"solver_work_cap" integer NOT NULL,
	"constraint_hash" text NOT NULL,
	"outcome" text NOT NULL,
	"selected_section_ids" uuid[],
	"result" jsonb NOT NULL,
	CONSTRAINT "plan_revision_plan_revision_key" UNIQUE("plan_id","revision"),
	CONSTRAINT "plan_revision_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "plan_revision_bounds" CHECK ("plan_revision"."revision" >= 1 AND cardinality("plan_revision"."course_ids") BETWEEN 1 AND 8
        AND "plan_revision"."solver_work_cap" BETWEEN 1 AND 3000000
        AND "plan_revision"."constraint_hash" ~ '^sha256:[0-9a-f]{64}$' AND length("plan_revision"."audit_source") > 0
        AND length("plan_revision"."audit_version") > 0 AND length("plan_revision"."ruleset_version") > 0
        AND "plan_revision"."cause" IN ('SAVED', 'REVALIDATED') AND "plan_revision"."outcome" IN
        ('OPTIONS_FOUND', 'NO_FEASIBLE_PLAN', 'SEARCH_TIMEOUT', 'NEEDS_VERIFICATION')),
	CONSTRAINT "plan_revision_selection_matches_outcome" CHECK (("plan_revision"."outcome" = 'OPTIONS_FOUND') = ("plan_revision"."selected_section_ids" IS NOT NULL)),
	CONSTRAINT "plan_revision_json_shape" CHECK (jsonb_typeof("plan_revision"."result") = 'object' AND jsonb_typeof("plan_revision"."credit_selections") = 'array'
        AND jsonb_typeof("plan_revision"."constraints") = 'array')
);
--> statement-breakpoint
CREATE TABLE "plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "plan_tenant_student_term_key" UNIQUE("tenant_id","student_id","term_id"),
	CONSTRAINT "plan_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "plan_tenant_id_id_student_id_term_id_key" UNIQUE("tenant_id","id","student_id","term_id")
);
--> statement-breakpoint
ALTER TABLE "plan_revision" ADD CONSTRAINT "plan_revision_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_revision" ADD CONSTRAINT "plan_revision_plan_fk" FOREIGN KEY ("tenant_id","plan_id","student_id","term_id") REFERENCES "public"."plan"("tenant_id","id","student_id","term_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_revision" ADD CONSTRAINT "plan_revision_student_snapshot_fk" FOREIGN KEY ("tenant_id","student_id","student_snapshot_id","student_record_effective_at") REFERENCES "public"."student_snapshot"("tenant_id","student_id","id","source_effective_at") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_revision" ADD CONSTRAINT "plan_revision_audit_snapshot_fk" FOREIGN KEY ("tenant_id","student_id","audit_snapshot_id","audit_source","audit_version","audit_record_effective_at") REFERENCES "public"."audit_snapshot"("tenant_id","student_id","id","audit_source","audit_version","student_record_effective_at") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_revision" ADD CONSTRAINT "plan_revision_section_snapshot_fk" FOREIGN KEY ("tenant_id","section_snapshot_id","term_id") REFERENCES "public"."section_snapshot"("tenant_id","id","term_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_revision" ADD CONSTRAINT "plan_revision_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."user_identity"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan" ADD CONSTRAINT "plan_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan" ADD CONSTRAINT "plan_student_fk" FOREIGN KEY ("tenant_id","student_id") REFERENCES "public"."student"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan" ADD CONSTRAINT "plan_term_fk" FOREIGN KEY ("tenant_id","term_id") REFERENCES "public"."term"("tenant_id","id") ON DELETE no action ON UPDATE no action;