import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
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
  return {
    id: "demo-user",
    name: "Demo User",
    email: demoEmail,
    image: null,
  };
}

export const authConfig = {
  secret: env.NEXTAUTH_SECRET,
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
