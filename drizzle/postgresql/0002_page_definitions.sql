CREATE TABLE "display_page_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "page_id" varchar(64) NOT NULL,
  "name" varchar(128) NOT NULL,
  "provider_type" varchar(32) NOT NULL,
  "template_id" varchar(64) NOT NULL,
  "source_id" uuid,
  "document_template" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "display_page_definitions_page_id_unique" UNIQUE("page_id")
);
--> statement-breakpoint
ALTER TABLE "display_page_definitions" ADD CONSTRAINT "display_page_definitions_source_id_usage_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."usage_sources"("id") ON DELETE set null ON UPDATE no action;
