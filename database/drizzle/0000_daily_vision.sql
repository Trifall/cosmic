CREATE TYPE "public"."visibility" AS ENUM('PUBLIC', 'AUTHENTICATED', 'INVITE_ONLY', 'PRIVATE');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"username" text NOT NULL,
	"display_username" text,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paste_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"paste_id" varchar(8) NOT NULL,
	"user_id" text NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"invited_by" text NOT NULL,
	CONSTRAINT "paste_invites_paste_user_unique" UNIQUE("paste_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "paste_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"paste_id" varchar(8) NOT NULL,
	"content" text NOT NULL,
	"version_number" integer NOT NULL,
	"change_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	CONSTRAINT "paste_versions_paste_version_unique" UNIQUE("paste_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "paste_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"paste_id" varchar(8) NOT NULL,
	"viewer_ip" varchar(45),
	"viewed_at" timestamp DEFAULT now() NOT NULL,
	"user_agent" text,
	"user_id" text,
	"referrer" text
);
--> statement-breakpoint
CREATE TABLE "pastes" (
	"id" varchar(8) PRIMARY KEY NOT NULL,
	"custom_slug" varchar(100),
	"content" text NOT NULL,
	"owner_id" text,
	"visibility" "visibility" DEFAULT 'PUBLIC' NOT NULL,
	"language" text DEFAULT 'plaintext',
	"title" text,
	"views" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"unique_views" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp,
	"search_vector" text,
	"current_version" integer DEFAULT 1 NOT NULL,
	"burn_after_reading" boolean DEFAULT false NOT NULL,
	"password_hash" text,
	"versioning_enabled" boolean DEFAULT false NOT NULL,
	"version_history_visible" boolean DEFAULT false NOT NULL,
	CONSTRAINT "pastes_custom_slug_unique" UNIQUE("custom_slug")
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"level" varchar NOT NULL,
	"source" varchar NOT NULL,
	"user_id" text,
	"message" text NOT NULL,
	"details" jsonb,
	"trace_id" varchar
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar PRIMARY KEY NOT NULL,
	"value" jsonb,
	"description" text,
	"category" varchar
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paste_invites" ADD CONSTRAINT "paste_invites_paste_id_pastes_id_fk" FOREIGN KEY ("paste_id") REFERENCES "public"."pastes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paste_invites" ADD CONSTRAINT "paste_invites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paste_invites" ADD CONSTRAINT "paste_invites_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paste_versions" ADD CONSTRAINT "paste_versions_paste_id_pastes_id_fk" FOREIGN KEY ("paste_id") REFERENCES "public"."pastes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paste_versions" ADD CONSTRAINT "paste_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paste_views" ADD CONSTRAINT "paste_views_paste_id_pastes_id_fk" FOREIGN KEY ("paste_id") REFERENCES "public"."pastes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paste_views" ADD CONSTRAINT "paste_views_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pastes" ADD CONSTRAINT "pastes_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paste_invites_paste_id_idx" ON "paste_invites" USING btree ("paste_id");--> statement-breakpoint
CREATE INDEX "paste_invites_user_id_idx" ON "paste_invites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "paste_versions_paste_id_idx" ON "paste_versions" USING btree ("paste_id");--> statement-breakpoint
CREATE INDEX "paste_versions_created_at_idx" ON "paste_versions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "paste_views_paste_id_idx" ON "paste_views" USING btree ("paste_id");--> statement-breakpoint
CREATE INDEX "paste_views_viewed_at_idx" ON "paste_views" USING btree ("viewed_at");--> statement-breakpoint
CREATE INDEX "paste_views_user_id_idx" ON "paste_views" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pastes_owner_id_idx" ON "pastes" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "pastes_visibility_idx" ON "pastes" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "pastes_created_at_idx" ON "pastes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "logs_trace_id_idx" ON "logs" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "logs_user_id_idx" ON "logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "logs_timestamp_idx" ON "logs" USING btree ("timestamp");
