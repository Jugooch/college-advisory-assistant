CREATE TABLE "academic_policy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"ruleset_version" text NOT NULL,
	"allows_in_progress_prerequisites" boolean NOT NULL,
	"pass_satisfies_minimum_grade" boolean,
	"letter_grade_order" text[] NOT NULL,
	"lowest_passing_letter_grade" text,
	"repeat_policy" text,
	"term_min_credits_hundredths" integer,
	"term_max_credits_hundredths" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_policy_tenant_id_ruleset_version_key" UNIQUE("tenant_id","ruleset_version"),
	CONSTRAINT "academic_policy_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "academic_policy_ruleset_version_not_empty" CHECK (length("academic_policy"."ruleset_version") > 0),
	CONSTRAINT "academic_policy_letter_grade_order_not_empty" CHECK (cardinality("academic_policy"."letter_grade_order") > 0),
	CONSTRAINT "academic_policy_term_credit_bounds_both_or_neither" CHECK (("academic_policy"."term_min_credits_hundredths" IS NULL) = ("academic_policy"."term_max_credits_hundredths" IS NULL)),
	CONSTRAINT "academic_policy_term_credit_bounds_range" CHECK ("academic_policy"."term_min_credits_hundredths" IS NULL
        OR ("academic_policy"."term_min_credits_hundredths" >= 0
          AND "academic_policy"."term_min_credits_hundredths" <= "academic_policy"."term_max_credits_hundredths"))
);
--> statement-breakpoint
CREATE TABLE "course" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_course_id" text NOT NULL,
	"label" text NOT NULL,
	"credits_hundredths" integer,
	"min_credits_hundredths" integer,
	"max_credits_hundredths" integer,
	"equivalency_group_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_tenant_id_source_course_id_key" UNIQUE("tenant_id","source_course_id"),
	CONSTRAINT "course_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "course_source_course_id_not_empty" CHECK (length("course"."source_course_id") > 0),
	CONSTRAINT "course_label_not_empty" CHECK (length("course"."label") > 0),
	CONSTRAINT "course_credit_form" CHECK (("course"."credits_hundredths" IS NOT NULL AND "course"."min_credits_hundredths" IS NULL AND "course"."max_credits_hundredths" IS NULL)
        OR ("course"."credits_hundredths" IS NULL AND "course"."min_credits_hundredths" IS NOT NULL AND "course"."max_credits_hundredths" IS NOT NULL)),
	CONSTRAINT "course_credits_nonnegative" CHECK (coalesce("course"."credits_hundredths", 0) >= 0
        AND coalesce("course"."min_credits_hundredths", 0) >= 0
        AND coalesce("course"."max_credits_hundredths", 0) >= 0),
	CONSTRAINT "course_credit_range" CHECK ("course"."min_credits_hundredths" IS NULL OR "course"."max_credits_hundredths" IS NULL
        OR "course"."min_credits_hundredths" <= "course"."max_credits_hundredths")
);
--> statement-breakpoint
CREATE TABLE "equivalency_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_equivalency_group_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equivalency_group_tenant_id_source_equivalency_group_id_key" UNIQUE("tenant_id","source_equivalency_group_id"),
	CONSTRAINT "equivalency_group_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "equivalency_group_source_id_not_empty" CHECK (length("equivalency_group"."source_equivalency_group_id") > 0)
);
--> statement-breakpoint
CREATE TABLE "prerequisite_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"ruleset_version" text NOT NULL,
	"expression" jsonb NOT NULL,
	"source_ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prerequisite_rule_tenant_id_course_id_ruleset_version_key" UNIQUE("tenant_id","course_id","ruleset_version"),
	CONSTRAINT "prerequisite_rule_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "prerequisite_rule_ruleset_version_not_empty" CHECK (length("prerequisite_rule"."ruleset_version") > 0),
	CONSTRAINT "prerequisite_rule_source_ref_not_empty" CHECK (length("prerequisite_rule"."source_ref") > 0),
	CONSTRAINT "prerequisite_rule_expression_object" CHECK (jsonb_typeof("prerequisite_rule"."expression") = 'object')
);
--> statement-breakpoint
CREATE TABLE "term" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"term_code" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"sequence" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "term_tenant_id_term_code_key" UNIQUE("tenant_id","term_code"),
	CONSTRAINT "term_tenant_id_sequence_key" UNIQUE("tenant_id","sequence"),
	CONSTRAINT "term_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "term_term_code_not_empty" CHECK (length("term"."term_code") > 0),
	CONSTRAINT "term_date_range" CHECK ("term"."starts_on" <= "term"."ends_on")
);
--> statement-breakpoint
ALTER TABLE "academic_policy" ADD CONSTRAINT "academic_policy_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_equivalency_group_fk" FOREIGN KEY ("tenant_id","equivalency_group_id") REFERENCES "public"."equivalency_group"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equivalency_group" ADD CONSTRAINT "equivalency_group_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prerequisite_rule" ADD CONSTRAINT "prerequisite_rule_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prerequisite_rule" ADD CONSTRAINT "prerequisite_rule_course_fk" FOREIGN KEY ("tenant_id","course_id") REFERENCES "public"."course"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term" ADD CONSTRAINT "term_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;