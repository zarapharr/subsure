CREATE TABLE IF NOT EXISTS "reminder_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subscription_candidate_id" text,
	"idempotency_key" text NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"template_id" text NOT NULL,
	"recipient" text NOT NULL,
	"payload_json" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"next_attempt_at" timestamp NOT NULL,
	"last_attempt_at" timestamp,
	"sent_at" timestamp,
	"last_error_code" text,
	"last_error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reminder_delivery_attempt" (
	"id" text PRIMARY KEY NOT NULL,
	"reminder_delivery_id" text NOT NULL,
	"attempt_number" integer NOT NULL,
	"status" text NOT NULL,
	"provider_message_id" text,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reminder_delivery" ADD CONSTRAINT "reminder_delivery_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reminder_delivery" ADD CONSTRAINT "reminder_delivery_subscription_candidate_id_subscription_candidate_id_fk" FOREIGN KEY ("subscription_candidate_id") REFERENCES "public"."subscription_candidate"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reminder_delivery_attempt" ADD CONSTRAINT "reminder_delivery_attempt_reminder_delivery_id_reminder_delivery_id_fk" FOREIGN KEY ("reminder_delivery_id") REFERENCES "public"."reminder_delivery"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reminder_delivery_idempotency_key_idx" ON "reminder_delivery" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reminder_delivery_queue_poll_idx" ON "reminder_delivery" USING btree ("status","next_attempt_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reminder_delivery_attempt_number_idx" ON "reminder_delivery_attempt" USING btree ("reminder_delivery_id","attempt_number");
