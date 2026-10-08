-- Hand-edited naming (#458, ADR-0013 §4). Replaces the selection check: only OPTIONS_FOUND may carry a
-- selection, a SAVED revision must, and a REVALIDATED one may lose it.
ALTER TABLE "plan_revision" DROP CONSTRAINT "plan_revision_selection_matches_outcome";--> statement-breakpoint
ALTER TABLE "plan_revision" ADD CONSTRAINT "plan_revision_selection_matches_outcome" CHECK (CASE WHEN "plan_revision"."outcome" <> 'OPTIONS_FOUND' THEN "plan_revision"."selected_section_ids" IS NULL
        WHEN "plan_revision"."cause" = 'SAVED' THEN "plan_revision"."selected_section_ids" IS NOT NULL
        ELSE true END);