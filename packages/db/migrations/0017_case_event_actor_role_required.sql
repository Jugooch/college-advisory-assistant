-- Hand-edited (#448, ADR-0013 Amendment 1). Reruns the #445 backfill for any case event still
-- without an actor role (CREATE and WITHDRAW are the student's; other actions are ADVISOR when
-- the actor's roles contain ADVISOR, otherwise ADMIN), then makes the column required. The
-- append-only trigger is lifted only around the UPDATE, inside one transaction (the DO block),
-- and restored before it ends.
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
END $$;--> statement-breakpoint
ALTER TABLE "case_event" ALTER COLUMN "actor_role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "case_event" DROP CONSTRAINT "case_event_actor_role_valid";--> statement-breakpoint
ALTER TABLE "case_event" ADD CONSTRAINT "case_event_actor_role_valid" CHECK ("case_event"."actor_role" IN ('STUDENT', 'ADVISOR', 'ADMIN'));
