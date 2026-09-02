CREATE TYPE "release_date_precision" AS ENUM('year', 'month', 'day');--> statement-breakpoint
CREATE TYPE "release_kind" AS ENUM('album', 'single', 'ep', 'compilation');--> statement-breakpoint
CREATE TYPE "spotify_album_type" AS ENUM('album', 'single', 'compilation');--> statement-breakpoint
CREATE TABLE "album_artists" (
	"album_id" uuid,
	"artist_id" uuid,
	"position" smallint NOT NULL,
	CONSTRAINT "album_artists_pkey" PRIMARY KEY("album_id","artist_id"),
	CONSTRAINT "album_artists_position_non_negative" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "albums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"spotify_id" varchar(255) NOT NULL UNIQUE,
	"name" text NOT NULL,
	"spotify_album_type" "spotify_album_type" NOT NULL,
	"release_kind" "release_kind",
	"release_date_raw" varchar(10) NOT NULL,
	"release_date_precision" "release_date_precision" NOT NULL,
	"release_year" smallint NOT NULL,
	"total_tracks" integer NOT NULL,
	"duration_ms" integer,
	"has_spotify_marked_explicit_tracks" boolean NOT NULL,
	"cover_url" text,
	"spotify_metadata_fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"spotify_id" varchar(255) NOT NULL UNIQUE,
	"name" text NOT NULL,
	"spotify_metadata_fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_albums" (
	"user_id" text,
	"album_id" uuid,
	"priority" smallint DEFAULT 0 NOT NULL,
	"notes" text,
	"rating" smallint,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"listened_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_albums_pkey" PRIMARY KEY("user_id","album_id"),
	CONSTRAINT "user_albums_priority_non_negative" CHECK ("priority" >= 0),
	CONSTRAINT "user_albums_rating_range" CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5))
);
--> statement-breakpoint
CREATE TABLE "daily_picks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"album_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"selected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"saved_to_spotify_at" timestamp with time zone,
	"save_error" text,
	CONSTRAINT "daily_picks_user_id_local_date_unique" UNIQUE("user_id","local_date"),
	CONSTRAINT "daily_picks_user_id_album_unique" UNIQUE("user_id","album_id")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY,
	"timezone" text DEFAULT 'America/Argentina/Buenos_Aires' NOT NULL,
	"include_spotify_marked_explicit_content" boolean DEFAULT false NOT NULL,
	"auto_save_to_spotify" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "album_tags" (
	"album_id" uuid,
	"tag_id" uuid,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "album_tags_pkey" PRIMARY KEY("album_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tag_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"key" text NOT NULL UNIQUE,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"category_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_category_slug_unique" UNIQUE("category_id","slug")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY,
	"issuer" text NOT NULL,
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
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "album_artists_album_position_unique" ON "album_artists" ("album_id","position");--> statement-breakpoint
CREATE INDEX "album_artists_artist_id_idx" ON "album_artists" ("artist_id");--> statement-breakpoint
CREATE INDEX "user_albums_album_id_idx" ON "user_albums" ("album_id");--> statement-breakpoint
CREATE INDEX "album_tags_tag_id_idx" ON "album_tags" ("tag_id");--> statement-breakpoint
CREATE INDEX "tags_parent_id_idx" ON "tags" ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_issuer_accountId_uidx" ON "accounts" ("issuer","account_id");--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "accounts" ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_userId_idx" ON "sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" ("identifier");--> statement-breakpoint
ALTER TABLE "album_artists" ADD CONSTRAINT "album_artists_album_id_albums_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "album_artists" ADD CONSTRAINT "album_artists_artist_id_artists_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_albums" ADD CONSTRAINT "user_albums_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_albums" ADD CONSTRAINT "user_albums_album_id_albums_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "daily_picks" ADD CONSTRAINT "daily_picks_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "daily_picks" ADD CONSTRAINT "daily_picks_album_id_albums_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "album_tags" ADD CONSTRAINT "album_tags_album_id_albums_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "album_tags" ADD CONSTRAINT "album_tags_tag_id_tags_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_category_id_tag_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "tag_categories"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "tags"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;