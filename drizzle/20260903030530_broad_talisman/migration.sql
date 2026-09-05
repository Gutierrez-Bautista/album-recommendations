CREATE TYPE "user_role" AS ENUM('user', 'admin');--> statement-breakpoint
ALTER TABLE "daily_picks" DROP CONSTRAINT "daily_picks_user_id_users_id_fkey";--> statement-breakpoint
ALTER TABLE "daily_picks" RENAME COLUMN "local_date" TO "pick_date";--> statement-breakpoint
ALTER TABLE "daily_picks" DROP CONSTRAINT "daily_picks_user_id_local_date_unique";--> statement-breakpoint
ALTER TABLE "daily_picks" DROP CONSTRAINT "daily_picks_user_id_album_unique";--> statement-breakpoint
ALTER TABLE "user_albums" DROP CONSTRAINT "user_albums_priority_non_negative";--> statement-breakpoint
ALTER TABLE "user_albums" ADD COLUMN "saved_to_spotify_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_picks" ADD COLUMN "cycle" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'user'::"user_role" NOT NULL;--> statement-breakpoint
ALTER TABLE "user_albums" DROP COLUMN "priority";--> statement-breakpoint
ALTER TABLE "daily_picks" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "daily_picks" DROP COLUMN "saved_to_spotify_at";--> statement-breakpoint
ALTER TABLE "daily_picks" DROP COLUMN "save_error";--> statement-breakpoint
ALTER TABLE "daily_picks" ADD CONSTRAINT "daily_picks_pick_date_unique" UNIQUE("pick_date");--> statement-breakpoint
ALTER TABLE "daily_picks" ADD CONSTRAINT "daily_picks_cycle_album_unique" UNIQUE("cycle","album_id");--> statement-breakpoint
ALTER TABLE "daily_picks" ADD CONSTRAINT "daily_picks_cycle_positive" CHECK ("cycle" >= 1);