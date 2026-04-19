CREATE TABLE IF NOT EXISTS "notification_preference" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"reminder_channel" text DEFAULT 'email' NOT NULL,
	"reminder_frequency" text DEFAULT 'weekly' NOT NULL,
	"unsubscribed_at" timestamp,
	"unsubscribe_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
DO $$ BEGIN
 ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_preference_user_id_uidx" ON "notification_preference" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_preference_channel_frequency_idx" ON "notification_preference" USING btree ("reminder_channel","reminder_frequency");--> statement-breakpoint
