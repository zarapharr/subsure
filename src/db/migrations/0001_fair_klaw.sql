ALTER TABLE "user" ADD COLUMN "auth_provider" text DEFAULT 'credentials' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;