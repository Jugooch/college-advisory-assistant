CREATE TABLE "policy_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_key" text NOT NULL,
	"revision" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"topic" text NOT NULL,
	"subject_key" text NOT NULL,
	"audience" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"approval_status" text NOT NULL,
	"approved_at" timestamp with time zone,
	"source_label" text NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "policy_document_tenant_id_document_key_revision_key" UNIQUE("tenant_id","document_key","revision"),
	CONSTRAINT "policy_document_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "policy_document_revision_positive" CHECK ("policy_document"."revision" >= 1),
	CONSTRAINT "policy_document_text_fields_not_empty" CHECK (length("policy_document"."document_key") > 0
      AND length("policy_document"."title") > 0 AND length("policy_document"."body") > 0
      AND length("policy_document"."subject_key") > 0 AND length("policy_document"."source_label") > 0),
	CONSTRAINT "policy_document_body_length" CHECK (length("policy_document"."body") <= 20000),
	CONSTRAINT "policy_document_topic_valid" CHECK ("policy_document"."topic" IN ('GENERAL', 'FINANCIAL_AID', 'IMMIGRATION', 'ATHLETICS', 'ACCESSIBILITY', 'APPEALS', 'CRISIS')),
	CONSTRAINT "policy_document_audience_valid" CHECK ("policy_document"."audience" IN ('STUDENT', 'ADVISOR', 'ALL')),
	CONSTRAINT "policy_document_approval_status_valid" CHECK ("policy_document"."approval_status" IN ('DRAFT', 'APPROVED', 'WITHDRAWN')),
	CONSTRAINT "policy_document_effective_range" CHECK ("policy_document"."effective_to" IS NULL OR "policy_document"."effective_to" > "policy_document"."effective_from"),
	CONSTRAINT "policy_document_approved_at_matches_status" CHECK (("policy_document"."approval_status" = 'APPROVED') = ("policy_document"."approved_at" IS NOT NULL)),
	CONSTRAINT "policy_document_content_hash_format" CHECK ("policy_document"."content_hash" ~ '^sha256:[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "policy_document" ADD CONSTRAINT "policy_document_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "policy_document_applicable_idx" ON "policy_document" USING btree ("tenant_id","approval_status","document_key","revision");