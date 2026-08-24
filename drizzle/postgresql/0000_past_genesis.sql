CREATE TYPE "public"."alert_operator" AS ENUM('gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'contains');--> statement-breakpoint
CREATE TYPE "public"."command_status" AS ENUM('queued', 'sent', 'confirmed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."device_status" AS ENUM('enrolling', 'online', 'offline', 'error');--> statement-breakpoint
CREATE TYPE "public"."ota_job_status" AS ENUM('awaiting_confirmation', 'queued', 'sent', 'downloading', 'verifying', 'rebooting', 'healthy', 'rolled_back', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."source_status" AS ENUM('active', 'paused', 'error');--> statement-breakpoint
CREATE TABLE "administrators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"source_id" uuid NOT NULL,
	"field" varchar(32) NOT NULL,
	"operator" "alert_operator" NOT NULL,
	"threshold" text NOT NULL,
	"severity" varchar(16) DEFAULT 'warning' NOT NULL,
	"message" varchar(256) NOT NULL,
	"device_ids" jsonb NOT NULL,
	"page_ids" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"test_only" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"last_value" jsonb,
	"last_evaluated_at" timestamp with time zone,
	"last_triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" varchar(128) NOT NULL,
	"token_hash" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" varchar(128) NOT NULL,
	"action" varchar(128) NOT NULL,
	"target" varchar(256) NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar(64) NOT NULL,
	"action" varchar(64) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "command_status" DEFAULT 'queued' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "device_enrollment_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pairing_code_hash" varchar(64) NOT NULL,
	"claim_secret_hash" varchar(64) NOT NULL,
	"board_model" varchar(64) NOT NULL,
	"claimed_device_id" varchar(64),
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"board_model" varchar(64) DEFAULT 'ESP32-S3-RLCD-4.2' NOT NULL,
	"status" "device_status" DEFAULT 'enrolling' NOT NULL,
	"firmware_version" varchar(64),
	"last_good_firmware_release_id" uuid,
	"wifi_rssi" integer,
	"active_page_id" varchar(64) DEFAULT 'system' NOT NULL,
	"desired_page_id" varchar(64),
	"enabled_page_ids" jsonb,
	"power_source" varchar(16),
	"charging" boolean,
	"battery_percent" integer,
	"battery_mv" integer,
	"power_updated_at" timestamp with time zone,
	"release_id" uuid,
	"last_seen_at" timestamp with time zone,
	"enrollment_code_hash" varchar(64),
	"enrollment_expires_at" timestamp with time zone,
	"mqtt_username" varchar(128),
	"mqtt_password_ciphertext" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "display_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"page_id" varchar(64) NOT NULL,
	"document_template" jsonb NOT NULL,
	"device_ids" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "display_release_pages" (
	"release_id" uuid NOT NULL,
	"page_id" varchar(64) NOT NULL,
	"position" integer NOT NULL,
	"document" jsonb NOT NULL,
	"preview_svg" text NOT NULL,
	"device_image" "bytea" NOT NULL,
	"image_format" varchar(32) DEFAULT 'mono1-msb' NOT NULL,
	"image_width" integer DEFAULT 400 NOT NULL,
	"image_height" integer DEFAULT 300 NOT NULL,
	"content_sha256" varchar(64) NOT NULL,
	CONSTRAINT "display_release_pages_release_id_page_id_pk" PRIMARY KEY("release_id","page_id")
);
--> statement-breakpoint
CREATE TABLE "display_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"page_id" varchar(64) NOT NULL,
	"document" jsonb NOT NULL,
	"preview_svg" text NOT NULL,
	"device_image" "bytea" NOT NULL,
	"image_format" varchar(32) DEFAULT 'mono1-msb' NOT NULL,
	"image_width" integer DEFAULT 400 NOT NULL,
	"image_height" integer DEFAULT 300 NOT NULL,
	"content_sha256" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "firmware_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" varchar(64) NOT NULL,
	"board_model" varchar(64) NOT NULL,
	"channel" varchar(16) DEFAULT 'stable' NOT NULL,
	"manifest_url" text NOT NULL,
	"image_url" text NOT NULL,
	"image_sha256" varchar(64) NOT NULL,
	"manifest_signature" text NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ota_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar(64) NOT NULL,
	"firmware_release_id" uuid NOT NULL,
	"ota_job_status" "ota_job_status" DEFAULT 'queued' NOT NULL,
	"nonce" varchar(128) NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"administrator_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"administrator_id" uuid NOT NULL,
	"token_selector" varchar(32),
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"values" jsonb NOT NULL,
	"response_preview" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"base_url" text NOT NULL,
	"request_path" text NOT NULL,
	"method" varchar(8) DEFAULT 'GET' NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"body_template" text,
	"secret_ciphertext" text NOT NULL,
	"mapper" jsonb NOT NULL,
	"refresh_interval_seconds" integer DEFAULT 900 NOT NULL,
	"source_status" "source_status" DEFAULT 'active' NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webauthn_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"administrator_id" uuid,
	"challenge" text NOT NULL,
	"purpose" varchar(32) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_source_id_usage_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."usage_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_enrollment_requests" ADD CONSTRAINT "device_enrollment_requests_claimed_device_id_devices_id_fk" FOREIGN KEY ("claimed_device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_last_good_firmware_release_id_firmware_releases_id_fk" FOREIGN KEY ("last_good_firmware_release_id") REFERENCES "public"."firmware_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_release_id_display_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."display_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "display_bindings" ADD CONSTRAINT "display_bindings_source_id_usage_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."usage_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "display_release_pages" ADD CONSTRAINT "display_release_pages_release_id_display_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."display_releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ota_jobs" ADD CONSTRAINT "ota_jobs_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ota_jobs" ADD CONSTRAINT "ota_jobs_firmware_release_id_firmware_releases_id_fk" FOREIGN KEY ("firmware_release_id") REFERENCES "public"."firmware_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_administrator_id_administrators_id_fk" FOREIGN KEY ("administrator_id") REFERENCES "public"."administrators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_administrator_id_administrators_id_fk" FOREIGN KEY ("administrator_id") REFERENCES "public"."administrators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_snapshots" ADD CONSTRAINT "source_snapshots_source_id_usage_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."usage_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webauthn_challenges" ADD CONSTRAINT "webauthn_challenges_administrator_id_administrators_id_fk" FOREIGN KEY ("administrator_id") REFERENCES "public"."administrators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "administrators_email_unique" ON "administrators" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "device_enrollment_requests_pairing_code_unique" ON "device_enrollment_requests" USING btree ("pairing_code_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "display_release_pages_position_unique" ON "display_release_pages" USING btree ("release_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "firmware_releases_version_board_unique" ON "firmware_releases" USING btree ("version","board_model");--> statement-breakpoint
CREATE UNIQUE INDEX "passkeys_credential_id_unique" ON "passkeys" USING btree ("credential_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_selector_unique" ON "sessions" USING btree ("token_selector");