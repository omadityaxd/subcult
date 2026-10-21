ALTER TABLE "fits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "fits_public_read_visible" ON "fits" CASCADE;--> statement-breakpoint
DROP POLICY "profiles_public_read" ON "profiles" CASCADE;--> statement-breakpoint
ALTER POLICY "niches_public_read" ON "niches" TO anon,authenticated USING ("niches"."status" = 'active');