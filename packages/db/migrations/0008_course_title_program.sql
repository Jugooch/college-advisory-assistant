CREATE TABLE "program" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_program_id" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "program_tenant_id_source_program_id_key" UNIQUE("tenant_id","source_program_id"),
	CONSTRAINT "program_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "program_source_program_id_not_empty" CHECK (length("program"."source_program_id") > 0),
	CONSTRAINT "program_name_not_empty" CHECK ("program"."name" IS NULL OR length("program"."name") > 0)
);
--> statement-breakpoint
ALTER TABLE "course" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "program" ADD CONSTRAINT "program_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_title_not_empty" CHECK ("course"."title" IS NULL OR length("course"."title") > 0);