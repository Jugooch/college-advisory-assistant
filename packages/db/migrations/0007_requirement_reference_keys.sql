CREATE TABLE "requirement_result_allocated_attempt" (
	"tenant_id" uuid NOT NULL,
	"audit_snapshot_id" uuid NOT NULL,
	"requirement_result_id" uuid NOT NULL,
	"student_snapshot_id" uuid NOT NULL,
	"course_attempt_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "requirement_result_allocated_attempt_pkey" PRIMARY KEY("tenant_id","requirement_result_id","course_attempt_id"),
	CONSTRAINT "requirement_result_allocated_attempt_position_key" UNIQUE("tenant_id","requirement_result_id","position"),
	CONSTRAINT "requirement_result_allocated_attempt_position_nonnegative" CHECK ("requirement_result_allocated_attempt"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "requirement_result_candidate_course" (
	"tenant_id" uuid NOT NULL,
	"audit_snapshot_id" uuid NOT NULL,
	"requirement_result_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "requirement_result_candidate_course_pkey" PRIMARY KEY("tenant_id","requirement_result_id","course_id"),
	CONSTRAINT "requirement_result_candidate_course_position_key" UNIQUE("tenant_id","requirement_result_id","position"),
	CONSTRAINT "requirement_result_candidate_course_position_nonnegative" CHECK ("requirement_result_candidate_course"."position" >= 0)
);
--> statement-breakpoint
-- Edited before merge: drizzle-kit emitted these two unique constraints after the foreign keys
-- that reference them, which PostgreSQL rejects. They must exist first.
ALTER TABLE "audit_snapshot" ADD CONSTRAINT "audit_snapshot_tenant_id_id_student_snapshot_id_key" UNIQUE("tenant_id","id","student_snapshot_id");--> statement-breakpoint
ALTER TABLE "requirement_result" ADD CONSTRAINT "requirement_result_tenant_id_audit_snapshot_id_id_key" UNIQUE("tenant_id","audit_snapshot_id","id");--> statement-breakpoint
ALTER TABLE "requirement_result_allocated_attempt" ADD CONSTRAINT "requirement_result_allocated_attempt_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_result_allocated_attempt" ADD CONSTRAINT "requirement_result_allocated_attempt_requirement_fk" FOREIGN KEY ("tenant_id","audit_snapshot_id","requirement_result_id") REFERENCES "public"."requirement_result"("tenant_id","audit_snapshot_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_result_allocated_attempt" ADD CONSTRAINT "requirement_result_allocated_attempt_audit_fk" FOREIGN KEY ("tenant_id","audit_snapshot_id","student_snapshot_id") REFERENCES "public"."audit_snapshot"("tenant_id","id","student_snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_result_allocated_attempt" ADD CONSTRAINT "requirement_result_allocated_attempt_snapshot_attempt_fk" FOREIGN KEY ("tenant_id","student_snapshot_id","course_attempt_id") REFERENCES "public"."student_snapshot_attempt"("tenant_id","student_snapshot_id","course_attempt_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_result_candidate_course" ADD CONSTRAINT "requirement_result_candidate_course_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_result_candidate_course" ADD CONSTRAINT "requirement_result_candidate_course_requirement_fk" FOREIGN KEY ("tenant_id","audit_snapshot_id","requirement_result_id") REFERENCES "public"."requirement_result"("tenant_id","audit_snapshot_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_result_candidate_course" ADD CONSTRAINT "requirement_result_candidate_course_course_fk" FOREIGN KEY ("tenant_id","course_id") REFERENCES "public"."course"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Edited before merge: copy the existing arrays into the new tables, keeping their order, before
-- the columns are dropped. A stored allocation outside the pinned snapshot, or a candidate outside
-- the tenant's catalog, fails the new keys here, so the migration stops instead of losing it.
INSERT INTO "requirement_result_allocated_attempt"
	("tenant_id", "audit_snapshot_id", "requirement_result_id", "student_snapshot_id", "course_attempt_id", "position")
SELECT r."tenant_id", r."audit_snapshot_id", r."id", a."student_snapshot_id", u."attempt_id", (u."ordinality" - 1)::integer
FROM "requirement_result" r
JOIN "audit_snapshot" a ON a."tenant_id" = r."tenant_id" AND a."id" = r."audit_snapshot_id"
CROSS JOIN LATERAL unnest(r."allocated_attempt_ids") WITH ORDINALITY AS u("attempt_id", "ordinality");--> statement-breakpoint
INSERT INTO "requirement_result_candidate_course"
	("tenant_id", "audit_snapshot_id", "requirement_result_id", "course_id", "position")
SELECT r."tenant_id", r."audit_snapshot_id", r."id", u."course_id", (u."ordinality" - 1)::integer
FROM "requirement_result" r
CROSS JOIN LATERAL unnest(r."candidate_course_ids") WITH ORDINALITY AS u("course_id", "ordinality");--> statement-breakpoint
ALTER TABLE "requirement_result" DROP COLUMN "allocated_attempt_ids";--> statement-breakpoint
ALTER TABLE "requirement_result" DROP COLUMN "candidate_course_ids";
