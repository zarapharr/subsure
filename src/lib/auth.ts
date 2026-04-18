import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db/client";

export const authConfig = {
  adapter: DrizzleAdapter(db),
  session: { strategy: "database" },
  providers: [],
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
