CREATE TABLE "conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"last_sequence" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "conversation_tenant_student_term_key" UNIQUE("tenant_id","student_id","term_id"),
	CONSTRAINT "conversation_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "conversation_last_sequence_shape" CHECK ("conversation"."last_sequence" >= 0)
);
--> statement-breakpoint
CREATE TABLE "conversation_turn" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"role" text NOT NULL,
	"text" text NOT NULL,
	"block_refs" jsonb,
	"model_status" text,
	"metadata" jsonb,
	"created_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "conversation_turn_conversation_sequence_key" UNIQUE("conversation_id","sequence"),
	CONSTRAINT "conversation_turn_shape" CHECK ("conversation_turn"."sequence" >= 1
        AND "conversation_turn"."role" IN ('STUDENT', 'ASSISTANT')
        AND ("conversation_turn"."role" = 'ASSISTANT') = ("conversation_turn"."block_refs" IS NOT NULL)
        AND ("conversation_turn"."role" = 'ASSISTANT') = ("conversation_turn"."metadata" IS NOT NULL)
        AND ("conversation_turn"."role" = 'ASSISTANT') = ("conversation_turn"."model_status" IS NOT NULL)
        AND ("conversation_turn"."model_status" IS NULL OR "conversation_turn"."model_status" IN
          ('ANSWERED', 'GUARDED', 'BUDGET_EXHAUSTED', 'MODEL_UNAVAILABLE')))
);
--> statement-breakpoint
CREATE TABLE "student_turn_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_tenant_id_institution_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."institution"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_student_fk" FOREIGN KEY ("tenant_id","student_id") REFERENCES "public"."student"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_term_fk" FOREIGN KEY ("tenant_id","term_id") REFERENCES "public"."term"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_turn" ADD CONSTRAINT "conversation_turn_conversation_fk" FOREIGN KEY ("tenant_id","conversation_id") REFERENCES "public"."conversation"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_turn_log" ADD CONSTRAINT "student_turn_log_student_fk" FOREIGN KEY ("tenant_id","student_id") REFERENCES "public"."student"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_turn_created_idx" ON "conversation_turn" USING btree ("tenant_id","conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "student_turn_log_window_idx" ON "student_turn_log" USING btree ("tenant_id","student_id","created_at");