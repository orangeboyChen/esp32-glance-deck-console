CREATE TABLE `display_page_definitions` (
  `id` text PRIMARY KEY NOT NULL,
  `page_id` text NOT NULL,
  `name` text NOT NULL,
  `provider_type` text NOT NULL,
  `template_id` text NOT NULL,
  `source_id` text,
  `document_template` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  CONSTRAINT `display_page_definitions_page_id_unique` UNIQUE(`page_id`),
  FOREIGN KEY (`source_id`) REFERENCES `usage_sources`(`id`) ON UPDATE no action ON DELETE set null
);
