CREATE TABLE "niches" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"profile" jsonb NOT NULL,
	"schema_version" integer NOT NULL,
	"generated_by" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "niches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "niches_created_at_idx" ON "niches" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "niches_public_read" ON "niches" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);