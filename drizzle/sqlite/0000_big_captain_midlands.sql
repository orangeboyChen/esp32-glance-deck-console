CREATE TABLE `administrators` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `administrators_email_unique` ON `administrators` (`email`);--> statement-breakpoint
CREATE TABLE `alert_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`source_id` text NOT NULL,
	`field` text NOT NULL,
	`operator` text NOT NULL,
	`threshold` text NOT NULL,
	`severity` text DEFAULT 'warning' NOT NULL,
	`message` text NOT NULL,
	`device_ids` text NOT NULL,
	`page_ids` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`test_only` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`last_value` text,
	`last_evaluated_at` integer,
	`last_triggered_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `usage_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`token_hash` text NOT NULL,
	`scopes` text NOT NULL,
	`revoked_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`metadata` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `device_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`action` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`error_message` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`confirmed_at` integer,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `device_enrollment_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`pairing_code_hash` text NOT NULL,
	`claim_secret_hash` text NOT NULL,
	`board_model` text NOT NULL,
	`claimed_device_id` text,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`claimed_device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_enrollment_requests_pairing_code_unique` ON `device_enrollment_requests` (`pairing_code_hash`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`board_model` text DEFAULT 'ESP32-S3-RLCD-4.2' NOT NULL,
	`status` text DEFAULT 'enrolling' NOT NULL,
	`firmware_version` text,
	`last_good_firmware_release_id` text,
	`wifi_rssi` integer,
	`active_page_id` text DEFAULT 'system' NOT NULL,
	`desired_page_id` text,
	`enabled_page_ids` text,
	`power_source` text,
	`charging` integer,
	`battery_percent` integer,
	`battery_mv` integer,
	`power_updated_at` integer,
	`release_id` text,
	`last_seen_at` integer,
	`enrollment_code_hash` text,
	`enrollment_expires_at` integer,
	`mqtt_username` text,
	`mqtt_password_ciphertext` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`last_good_firmware_release_id`) REFERENCES `firmware_releases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`release_id`) REFERENCES `display_releases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `display_bindings` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`page_id` text NOT NULL,
	`document_template` text NOT NULL,
	`device_ids` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `usage_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `display_release_pages` (
	`release_id` text NOT NULL,
	`page_id` text NOT NULL,
	`position` integer NOT NULL,
	`document` text NOT NULL,
	`preview_svg` text NOT NULL,
	`device_image` blob NOT NULL,
	`image_format` text DEFAULT 'mono1-msb' NOT NULL,
	`image_width` integer DEFAULT 400 NOT NULL,
	`image_height` integer DEFAULT 300 NOT NULL,
	`content_sha256` text NOT NULL,
	PRIMARY KEY(`release_id`, `page_id`),
	FOREIGN KEY (`release_id`) REFERENCES `display_releases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `display_release_pages_position_unique` ON `display_release_pages` (`release_id`,`position`);--> statement-breakpoint
CREATE TABLE `display_releases` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`page_id` text NOT NULL,
	`document` text NOT NULL,
	`preview_svg` text NOT NULL,
	`device_image` blob NOT NULL,
	`image_format` text DEFAULT 'mono1-msb' NOT NULL,
	`image_width` integer DEFAULT 400 NOT NULL,
	`image_height` integer DEFAULT 300 NOT NULL,
	`content_sha256` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `firmware_releases` (
	`id` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`board_model` text NOT NULL,
	`channel` text DEFAULT 'stable' NOT NULL,
	`manifest_url` text NOT NULL,
	`image_url` text NOT NULL,
	`image_sha256` text NOT NULL,
	`manifest_signature` text NOT NULL,
	`verified_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `firmware_releases_version_board_unique` ON `firmware_releases` (`version`,`board_model`);--> statement-breakpoint
CREATE TABLE `ota_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`firmware_release_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`nonce` text NOT NULL,
	`error_message` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`firmware_release_id`) REFERENCES `firmware_releases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `passkeys` (
	`id` text PRIMARY KEY NOT NULL,
	`administrator_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`public_key` text NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`transports` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`administrator_id`) REFERENCES `administrators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `passkeys_credential_id_unique` ON `passkeys` (`credential_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`administrator_id` text NOT NULL,
	`token_selector` text,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`administrator_id`) REFERENCES `administrators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_selector_unique` ON `sessions` (`token_selector`);--> statement-breakpoint
CREATE TABLE `source_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`values` text NOT NULL,
	`response_preview` text,
	`fetched_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `usage_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `usage_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`request_path` text NOT NULL,
	`method` text DEFAULT 'GET' NOT NULL,
	`headers` text DEFAULT '{}' NOT NULL,
	`body_template` text,
	`secret_ciphertext` text NOT NULL,
	`mapper` text NOT NULL,
	`refresh_interval_seconds` integer DEFAULT 900 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_success_at` integer,
	`last_error` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `webauthn_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`administrator_id` text,
	`challenge` text NOT NULL,
	`purpose` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`administrator_id`) REFERENCES `administrators`(`id`) ON UPDATE no action ON DELETE cascade
);
