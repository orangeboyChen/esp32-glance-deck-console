ALTER TYPE "public"."source_status" ADD VALUE 'refreshing';--> statement-breakpoint
ALTER TABLE "usage_sources" ADD COLUMN "last_attempt_at" timestamp with time zone;