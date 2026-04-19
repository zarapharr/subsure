import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  AUTH_CREDENTIALS_DEMO_EMAIL: z.string().email().optional(),
  AUTH_CREDENTIALS_DEMO_PASSWORD: z.string().min(8).optional(),
  PLAID_CLIENT_ID: z.string().optional(),
  PLAID_SECRET: z.string().optional(),
  PLAID_ENV: z.enum(["sandbox", "development", "production"]).optional(),
  PLAID_PRODUCTS: z.string().optional(),
  PLAID_COUNTRY_CODES: z.string().optional(),
  PLAID_WEBHOOK_URL: z.string().url().optional(),
  PLAID_REFRESH_CRON_SECRET: z.string().optional(),
  POSTHOG_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
