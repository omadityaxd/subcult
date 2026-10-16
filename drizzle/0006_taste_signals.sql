CREATE TABLE "taste_signals" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "taste_signals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"entity" text NOT NULL,
	"label" text NOT NULL,
	"strength" real DEFAULT 1 NOT NULL,
	"at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "taste_signals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "taste_signals_event_idx" ON "taste_signals" USING btree ("user_id","kind","entity","at");--> statement-breakpoint
CREATE INDEX "taste_signals_user_at_idx" ON "taste_signals" USING btree ("user_id","at" DESC NULLS LAST);