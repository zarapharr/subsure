import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/env";

// Lazily construct the client so build-time `next build` without DATABASE_URL
// does not crash. Server code that actually touches the DB must provide it.
const connectionString =
  env.DATABASE_URL ?? "postgres://placeholder:placeholder@localhost:5432/subsure";

const client = postgres(connectionString, {
  max: 1,
  prepare: false,
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
