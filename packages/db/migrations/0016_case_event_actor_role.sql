-- Hand-edited backfill (#445, ADR-0013 Amendment 1). Adds the nullable actor role, then fills
-- existing rows: CREATE and WITHDRAW are the student's; other actions are ADVISOR when the actor's
-- roles contain ADVISOR, otherwise ADMIN. The append-only trigger is lifted only for this UPDATE,
-- inside one transaction (the DO block), and restored before it ends.
ALTER TABLE "case_event" ADD COLUMN "actor_role" text;--> statement-breakpoint
ALTER TABLE "case_event" ADD CONSTRAINT "case_event_actor_role_valid" CHECK ("case_event"."actor_role" IS NULL OR "case_event"."actor_role" IN ('STUDENT', 'ADVISOR', 'ADMIN'));--> statement-breakpoint
DO $$
BEGIN
	ALTER TABLE "case_event" DISABLE TRIGGER "case_event_immutable_row";
	UPDATE "case_event" AS e
	SET "actor_role" = CASE
		WHEN e."action" IN ('CREATE', 'WITHDRAW') THEN 'STUDENT'
		WHEN 'ADVISOR' = ANY (u."roles") THEN 'ADVISOR'
		ELSE 'ADMIN'
	END
	FROM "user_identity" AS u
	WHERE u."tenant_id" = e."tenant_id" AND u."id" = e."actor_user_id" AND e."actor_role" IS NULL;
	ALTER TABLE "case_event" ENABLE TRIGGER "case_event_immutable_row";
END $$;
