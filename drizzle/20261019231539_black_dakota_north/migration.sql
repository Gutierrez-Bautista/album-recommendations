ALTER TABLE "albums" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_picks" ALTER COLUMN "cycle" DROP DEFAULT;