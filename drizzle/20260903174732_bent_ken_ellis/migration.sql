CREATE TABLE "user_legal_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"terms_version" varchar(32) NOT NULL,
	"privacy_policy_version" varchar(32) NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_legal_acceptances_user_versions_unique" UNIQUE("user_id","terms_version","privacy_policy_version")
);
--> statement-breakpoint
CREATE INDEX "user_legal_acceptances_user_id_idx" ON "user_legal_acceptances" ("user_id");--> statement-breakpoint
ALTER TABLE "user_legal_acceptances" ADD CONSTRAINT "user_legal_acceptances_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;