ALTER TABLE "profile_settings" ADD COLUMN "founding_no" integer;--> statement-breakpoint
ALTER TABLE "profile_settings" ADD CONSTRAINT "profile_settings_founding_no_unique" UNIQUE("founding_no");