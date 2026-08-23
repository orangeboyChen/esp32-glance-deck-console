ALTER TABLE "usage_sources" ADD COLUMN IF NOT EXISTS "last_attempt_at" timestamp with time zone;
ALTER TYPE "source_status" ADD VALUE IF NOT EXISTS 'refreshing';
