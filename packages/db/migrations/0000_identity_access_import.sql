CREATE TABLE "advisor_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"advisor_user_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"approved_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advisor_assignment_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "advisor_assignment_effective_range" CHECK ("advisor_assignment"."effective_to" IS NULL OR "advisor_assignment"."effective_to" >= "advisor_assignment"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "import_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"schema_version" text NOT NULL,
	"batch_id" text NOT NULL,
	"extracted_at" timestamp with time zone NOT NULL,
	"source_effective_at" timestamp with time zone NOT NULL,
	"checksum" text NOT NULL,
	"record_count" integer NOT NULL,
	"operation" text NOT NULL,
	"status" text NOT NULL,
	"rejected_count" integer NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_batch_tenant_id_source_id_batch_id_key" UNIQUE("tenant_id","source_id","batch_id"),
	CONSTRAINT "import_batch_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "import_batch_record_count_nonnegative" CHECK ("import_batch"."record_count" >= 0),
	CONSTRAINT "import_batch_rejected_count_nonnegative" CHECK ("import_batch"."rejected_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "import_quarantine" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"import_batch_id" uuid NOT NULL,
	"row_index" integer NOT NULL,
	"source_record_id" text,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_quarantine_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "import_quarantine_row_index_nonnegative" CHECK ("import_quarantine"."row_index" >= 0),
	CONSTRAINT "import_quarantine_reason_not_empty" CHECK (length("import_quarantine"."reason") > 0)
);
--> statement-breakpoint
CREATE TABLE "institution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"timezone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_student_id" text NOT NULL,
	"user_id" uuid,
	"record_version" integer,
	"source_effective_at" timestamp with time zone NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_tenant_id_source_student_id_key" UNIQUE("tenant_id","source_student_id"),
	CONSTRAINT "student_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "user_identity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"roles" text[] NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_identity_issuer_subject_key" UNIQUE("issuer","subject"),
	CONSTRAINT "user_identity_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "user_identity_roles_not_empty" CHECK (cardinality("user_identity"."roles") > 0)
);
--> statement-breakpoint
ALTER TABLE "advisor_assignment" ADD CONSTRAINT "advisor_assignment_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_assignment" ADD CONSTRAINT "advisor_assignment_advisor_fk" FOREIGN KEY ("tenant_id","advisor_user_id") REFERENCES "public"."user_identity"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_assignment" ADD CONSTRAINT "advisor_assignment_student_fk" FOREIGN KEY ("tenant_id","student_id") REFERENCES "public"."student"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_assignment" ADD CONSTRAINT "advisor_assignment_approver_fk" FOREIGN KEY ("tenant_id","approved_by") REFERENCES "public"."user_identity"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_quarantine" ADD CONSTRAINT "import_quarantine_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_quarantine" ADD CONSTRAINT "import_quarantine_batch_fk" FOREIGN KEY ("tenant_id","import_batch_id") REFERENCES "public"."import_batch"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."user_identity"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identity" ADD CONSTRAINT "user_identity_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advisor_assignment_lookup_idx" ON "advisor_assignment" USING btree ("tenant_id","advisor_user_id","student_id");