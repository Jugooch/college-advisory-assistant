ALTER TABLE "student" ADD COLUMN "source_id" text;--> statement-breakpoint
CREATE INDEX "student_tenant_id_source_id_idx" ON "student" USING btree ("tenant_id","source_id");--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_source_id_not_empty" CHECK ("student"."source_id" IS NULL OR length("student"."source_id") > 0);