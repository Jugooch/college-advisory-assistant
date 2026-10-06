ALTER TABLE "course" ADD COLUMN "repeatable_for_credit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "course" ADD COLUMN "repeat_max_attempts" integer;--> statement-breakpoint
ALTER TABLE "course" ADD COLUMN "repeat_max_credits_hundredths" integer;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_repeat_caps_need_flag" CHECK ("course"."repeatable_for_credit" OR ("course"."repeat_max_attempts" IS NULL AND "course"."repeat_max_credits_hundredths" IS NULL));--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_repeat_max_attempts_min" CHECK ("course"."repeat_max_attempts" IS NULL OR "course"."repeat_max_attempts" >= 2);--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_repeat_max_credits_positive" CHECK ("course"."repeat_max_credits_hundredths" IS NULL OR "course"."repeat_max_credits_hundredths" > 0);