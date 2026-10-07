-- The unique key the case foreign key references is created first, so the key exists when it is used.
ALTER TABLE "plan_revision" ADD CONSTRAINT "plan_revision_tenant_id_id_plan_id_student_id_key" UNIQUE("tenant_id","id","plan_id","student_id");
--> statement-breakpoint
CREATE TABLE "advising_case" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"plan_revision_id" uuid,
	"plan_id" uuid,
	"discrepancy_subject" text,
	"student_note" text NOT NULL,
	"status" text NOT NULL,
	"owner_user_id" uuid,
	"created_at" timestamp (3) with time zone NOT NULL,
	"last_sequence" integer NOT NULL,
	CONSTRAINT "advising_case_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "advising_case_shape" CHECK ("advising_case"."reason" IN ('PLAN_REVIEW', 'NEEDS_VERIFICATION', 'SOURCE_DISCREPANCY')
        AND "advising_case"."status" IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'WITHDRAWN')
        AND "advising_case"."last_sequence" >= 1
        AND char_length(btrim("advising_case"."student_note")) BETWEEN 1 AND 500
        AND ("advising_case"."plan_revision_id" IS NULL) = ("advising_case"."plan_id" IS NULL)
        AND ("advising_case"."reason" = 'SOURCE_DISCREPANCY' OR "advising_case"."plan_revision_id" IS NOT NULL)
        AND ("advising_case"."reason" = 'SOURCE_DISCREPANCY') = ("advising_case"."discrepancy_subject" IS NOT NULL)
        AND ("advising_case"."discrepancy_subject" IS NULL OR "advising_case"."discrepancy_subject" IN
          ('PROGRAM_OR_CATALOG', 'COURSE_ATTEMPT', 'AUDIT_REQUIREMENT', 'SECTION'))
        AND ("advising_case"."status" IN ('IN_REVIEW', 'RESOLVED')) = ("advising_case"."owner_user_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "case_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"at" timestamp (3) with time zone NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"resolution" text,
	"note" text,
	CONSTRAINT "case_event_case_id_sequence_key" UNIQUE("case_id","sequence"),
	CONSTRAINT "case_event_shape" CHECK ("case_event"."sequence" >= 1
        AND "case_event"."action" IN ('CREATE', 'CLAIM', 'RELEASE', 'RESOLVE', 'WITHDRAW')
        AND "case_event"."to_status" IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'WITHDRAWN')
        AND ("case_event"."from_status" IS NULL OR "case_event"."from_status" IN
          ('OPEN', 'IN_REVIEW', 'RESOLVED', 'WITHDRAWN'))
        AND ("case_event"."action" = 'CREATE') = ("case_event"."from_status" IS NULL)
        AND ("case_event"."action" = 'CREATE') = ("case_event"."sequence" = 1)
        AND ("case_event"."action" = 'RESOLVE') = ("case_event"."resolution" IS NOT NULL)
        AND ("case_event"."resolution" IS NULL OR "case_event"."resolution" IN
          ('PLAN_REVIEWED', 'STUDENT_ACTION_NEEDED', 'REFERRED_OUTSIDE_APP'))
        AND ("case_event"."note" IS NULL OR ("case_event"."action" = 'RESOLVE'
          AND char_length(btrim("case_event"."note")) BETWEEN 1 AND 1000)))
);
--> statement-breakpoint
ALTER TABLE "advising_case" ADD CONSTRAINT "advising_case_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advising_case" ADD CONSTRAINT "advising_case_student_fk" FOREIGN KEY ("tenant_id","student_id") REFERENCES "public"."student"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advising_case" ADD CONSTRAINT "advising_case_plan_revision_fk" FOREIGN KEY ("tenant_id","plan_revision_id","plan_id","student_id") REFERENCES "public"."plan_revision"("tenant_id","id","plan_id","student_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advising_case" ADD CONSTRAINT "advising_case_owner_fk" FOREIGN KEY ("tenant_id","owner_user_id") REFERENCES "public"."user_identity"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_event" ADD CONSTRAINT "case_event_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_event" ADD CONSTRAINT "case_event_case_fk" FOREIGN KEY ("tenant_id","case_id") REFERENCES "public"."advising_case"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_event" ADD CONSTRAINT "case_event_actor_fk" FOREIGN KEY ("tenant_id","actor_user_id") REFERENCES "public"."user_identity"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "advising_case_one_open_per_plan_idx" ON "advising_case" USING btree ("tenant_id","plan_id") WHERE "advising_case"."status" IN ('OPEN', 'IN_REVIEW') AND "advising_case"."plan_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "advising_case_student_idx" ON "advising_case" USING btree ("tenant_id","student_id","created_at");--> statement-breakpoint
CREATE INDEX "advising_case_status_idx" ON "advising_case" USING btree ("tenant_id","status","created_at");
