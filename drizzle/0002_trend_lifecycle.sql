ALTER TABLE "niches" ADD COLUMN "kind" text DEFAULT 'evergreen' NOT NULL;--> statement-breakpoint
ALTER TABLE "niches" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "niches" ADD COLUMN "trend_score" real;--> statement-breakpoint
ALTER TABLE "niches" ADD COLUMN "sources" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "niches" ADD COLUMN "published_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "niches" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "niches" ADD COLUMN "refreshed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "niches_kind_status_published_idx" ON "niches" USING btree ("kind","status","published_at" DESC NULLS LAST);