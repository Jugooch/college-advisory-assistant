CREATE TABLE "audit_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"student_snapshot_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"audit_source" text NOT NULL,
	"audit_version" text NOT NULL,
	"catalog_year" text NOT NULL,
	"generated_at" timestamp (3) with time zone NOT NULL,
	"student_record_effective_at" timestamp (3) with time zone NOT NULL,
	"ingested_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_snapshot_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "audit_snapshot_run_key" UNIQUE("tenant_id","student_id","audit_source","audit_version"),
	CONSTRAINT "audit_snapshot_text_not_empty" CHECK (length("audit_snapshot"."audit_source") > 0 AND length("audit_snapshot"."audit_version") > 0
        AND length("audit_snapshot"."catalog_year") > 0),
	CONSTRAINT "audit_snapshot_record_before_generated" CHECK ("audit_snapshot"."student_record_effective_at" <= "audit_snapshot"."generated_at")
);
--> statement-breakpoint
CREATE TABLE "course_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"source_attempt_id" text NOT NULL,
	"term_code" text NOT NULL,
	"status" text NOT NULL,
	"grade_scheme" text,
	"grade_value" text,
	"credits_earned_hundredths" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_attempt_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "course_attempt_tenant_id_student_id_id_key" UNIQUE("tenant_id","student_id","id"),
	CONSTRAINT "course_attempt_source_attempt_id_not_empty" CHECK (length("course_attempt"."source_attempt_id") > 0),
	CONSTRAINT "course_attempt_term_code_not_empty" CHECK (length("course_attempt"."term_code") > 0),
	CONSTRAINT "course_attempt_grade_both_or_neither" CHECK (("course_attempt"."grade_scheme" IS NULL) = ("course_attempt"."grade_value" IS NULL)),
	CONSTRAINT "course_attempt_credits_nonnegative" CHECK ("course_attempt"."credits_earned_hundredths" IS NULL OR "course_attempt"."credits_earned_hundredths" >= 0),
	CONSTRAINT "course_attempt_ungraded_status_has_no_grade" CHECK ("course_attempt"."status" NOT IN ('IN_PROGRESS', 'TRANSFER_PENDING') OR "course_attempt"."grade_scheme" IS NULL),
	CONSTRAINT "course_attempt_credits_only_when_earned" CHECK ("course_attempt"."credits_earned_hundredths" IS NULL OR "course_attempt"."status" IN ('COMPLETED', 'TRANSFER_AWARDED'))
);
--> statement-breakpoint
CREATE TABLE "requirement_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"audit_snapshot_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"source_requirement_id" text NOT NULL,
	"parent_source_requirement_id" text,
	"label" text NOT NULL,
	"state" text NOT NULL,
	"allocated_attempt_ids" uuid[] NOT NULL,
	"remaining_credits_hundredths" integer,
	"remaining_course_count" integer,
	"candidate_course_ids" uuid[] NOT NULL,
	"is_reusable" boolean NOT NULL,
	"source_ref" text NOT NULL,
	CONSTRAINT "requirement_result_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "requirement_result_source_requirement_key" UNIQUE("tenant_id","audit_snapshot_id","source_requirement_id"),
	CONSTRAINT "requirement_result_position_key" UNIQUE("tenant_id","audit_snapshot_id","position"),
	CONSTRAINT "requirement_result_not_own_parent" CHECK ("requirement_result"."parent_source_requirement_id" IS NULL
        OR "requirement_result"."parent_source_requirement_id" <> "requirement_result"."source_requirement_id"),
	CONSTRAINT "requirement_result_position_nonnegative" CHECK ("requirement_result"."position" >= 0),
	CONSTRAINT "requirement_result_text_not_empty" CHECK (length("requirement_result"."source_requirement_id") > 0 AND length("requirement_result"."label") > 0
        AND length("requirement_result"."source_ref") > 0),
	CONSTRAINT "requirement_result_remaining_nonnegative" CHECK (coalesce("requirement_result"."remaining_credits_hundredths", 0) >= 0
        AND coalesce("requirement_result"."remaining_course_count", 0) >= 0),
	CONSTRAINT "requirement_result_complete_has_no_remainder" CHECK ("requirement_result"."state" <> 'COMPLETE'
        OR (coalesce("requirement_result"."remaining_credits_hundredths", 0) = 0
          AND coalesce("requirement_result"."remaining_course_count", 0) = 0))
);
--> statement-breakpoint
CREATE TABLE "student_snapshot_attempt" (
	"tenant_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"student_snapshot_id" uuid NOT NULL,
	"course_attempt_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "student_snapshot_attempt_pkey" PRIMARY KEY("tenant_id","student_snapshot_id","course_attempt_id"),
	CONSTRAINT "student_snapshot_attempt_position_key" UNIQUE("tenant_id","student_snapshot_id","position"),
	CONSTRAINT "student_snapshot_attempt_position_nonnegative" CHECK ("student_snapshot_attempt"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "student_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"program_id" uuid,
	"catalog_year" text,
	"source_effective_at" timestamp (3) with time zone NOT NULL,
	"ingested_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_snapshot_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "student_snapshot_tenant_id_student_id_id_key" UNIQUE("tenant_id","student_id","id"),
	CONSTRAINT "student_snapshot_catalog_year_not_empty" CHECK ("student_snapshot"."catalog_year" IS NULL OR length("student_snapshot"."catalog_year") > 0),
	CONSTRAINT "student_snapshot_effective_before_ingested" CHECK ("student_snapshot"."source_effective_at" <= "student_snapshot"."ingested_at")
);
--> statement-breakpoint
ALTER TABLE "audit_snapshot" ADD CONSTRAINT "audit_snapshot_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_snapshot" ADD CONSTRAINT "audit_snapshot_student_snapshot_fk" FOREIGN KEY ("tenant_id","student_id","student_snapshot_id") REFERENCES "public"."student_snapshot"("tenant_id","student_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_attempt" ADD CONSTRAINT "course_attempt_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_attempt" ADD CONSTRAINT "course_attempt_student_fk" FOREIGN KEY ("tenant_id","student_id") REFERENCES "public"."student"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_attempt" ADD CONSTRAINT "course_attempt_course_fk" FOREIGN KEY ("tenant_id","course_id") REFERENCES "public"."course"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_result" ADD CONSTRAINT "requirement_result_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_result" ADD CONSTRAINT "requirement_result_audit_snapshot_fk" FOREIGN KEY ("tenant_id","audit_snapshot_id") REFERENCES "public"."audit_snapshot"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_result" ADD CONSTRAINT "requirement_result_parent_fk" FOREIGN KEY ("tenant_id","audit_snapshot_id","parent_source_requirement_id") REFERENCES "public"."requirement_result"("tenant_id","audit_snapshot_id","source_requirement_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_snapshot_attempt" ADD CONSTRAINT "student_snapshot_attempt_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_snapshot_attempt" ADD CONSTRAINT "student_snapshot_attempt_snapshot_fk" FOREIGN KEY ("tenant_id","student_id","student_snapshot_id") REFERENCES "public"."student_snapshot"("tenant_id","student_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_snapshot_attempt" ADD CONSTRAINT "student_snapshot_attempt_attempt_fk" FOREIGN KEY ("tenant_id","student_id","course_attempt_id") REFERENCES "public"."course_attempt"("tenant_id","student_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_snapshot" ADD CONSTRAINT "student_snapshot_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_snapshot" ADD CONSTRAINT "student_snapshot_student_fk" FOREIGN KEY ("tenant_id","student_id") REFERENCES "public"."student"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_snapshot_latest_idx" ON "audit_snapshot" USING btree ("tenant_id","student_id","generated_at","ingested_at");--> statement-breakpoint
CREATE INDEX "student_snapshot_latest_idx" ON "student_snapshot" USING btree ("tenant_id","student_id","source_effective_at","ingested_at");