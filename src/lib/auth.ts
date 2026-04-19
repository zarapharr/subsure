import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { env } from "@/env";

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

async function authorizeCredentials(rawCredentials: unknown) {
  const parsedCredentials = CredentialsSchema.safeParse(rawCredentials);
  if (!parsedCredentials.success) return null;

  const { email, password } = parsedCredentials.data;
  const demoEmail = env.AUTH_CREDENTIALS_DEMO_EMAIL;
  const demoPassword = env.AUTH_CREDENTIALS_DEMO_PASSWORD;

  // Scaffold guardrail: do not accept credentials unless demo values are configured.
  if (!demoEmail || !demoPassword) return null;
  if (email !== demoEmail || password !== demoPassword) return null;

  const existing = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const existingUser = existing[0];
  if (existingUser) return existingUser;

  const inserted = await db
    .insert(users)
    .values({
      email,
      name: email.split("@")[0],
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
    });

  const insertedUser = inserted[0];
  return insertedUser ?? null;
}

export const authConfig = {
  adapter: DrizzleAdapter(db),
  // Credentials provider in Auth.js v5 requires JWT sessions.
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: authorizeCredentials,
    }),
  ],
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
