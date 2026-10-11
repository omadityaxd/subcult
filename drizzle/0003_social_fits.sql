CREATE TABLE "fit_likes" (
	"fit_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fit_likes_fit_id_user_id_pk" PRIMARY KEY("fit_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "fit_likes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fit_reports" (
	"fit_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fit_reports_fit_id_reporter_id_pk" PRIMARY KEY("fit_id","reporter_id")
);
--> statement-breakpoint
ALTER TABLE "fit_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fit_saves" (
	"fit_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fit_saves_fit_id_user_id_pk" PRIMARY KEY("fit_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "fit_saves" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"image_path" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"caption" text,
	"niches" text[] DEFAULT '{}'::text[] NOT NULL,
	"brands" text[] DEFAULT '{}'::text[] NOT NULL,
	"pieces" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"song" jsonb,
	"status" text DEFAULT 'visible' NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"report_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fit_likes" ADD CONSTRAINT "fit_likes_fit_id_fits_id_fk" FOREIGN KEY ("fit_id") REFERENCES "public"."fits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fit_reports" ADD CONSTRAINT "fit_reports_fit_id_fits_id_fk" FOREIGN KEY ("fit_id") REFERENCES "public"."fits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fit_saves" ADD CONSTRAINT "fit_saves_fit_id_fits_id_fk" FOREIGN KEY ("fit_id") REFERENCES "public"."fits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fits" ADD CONSTRAINT "fits_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fit_saves_user_idx" ON "fit_saves" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "fits_status_created_idx" ON "fits" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "fits_user_created_idx" ON "fits" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "fits_niches_idx" ON "fits" USING gin ("niches");--> statement-breakpoint
CREATE POLICY "fits_public_read_visible" ON "fits" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("fits"."status" = 'visible');--> statement-breakpoint
CREATE POLICY "profiles_public_read" ON "profiles" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);