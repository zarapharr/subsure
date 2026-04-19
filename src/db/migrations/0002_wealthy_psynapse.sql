CREATE TABLE IF NOT EXISTS "validation_decision" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subscription_candidate_id" text,
	"card_id" text NOT NULL,
	"merchant" text NOT NULL,
	"decision_id" text NOT NULL,
	"amount_cents" integer,
	"cadence" text,
	"decided_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "validation_decision" ADD CONSTRAINT "validation_decision_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "validation_decision" ADD CONSTRAINT "validation_decision_subscription_candidate_id_subscription_candidate_id_fk" FOREIGN KEY ("subscription_candidate_id") REFERENCES "public"."subscription_candidate"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "validation_decision_user_decided_idx" ON "validation_decision" USING btree ("user_id","decided_at");