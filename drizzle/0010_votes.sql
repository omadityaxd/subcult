CREATE TABLE "votes" (
	"target_id" text NOT NULL,
	"voter" text NOT NULL,
	"choice" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_target_id_voter_pk" PRIMARY KEY("target_id","voter"),
	CONSTRAINT "votes_choice_check" CHECK ("choice" IN ('cop', 'drop', 'a', 'b'))
);
--> statement-breakpoint
ALTER TABLE "votes" ENABLE ROW LEVEL SECURITY;