import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function resolveAuthedUserId(): Promise<string | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;

  const result = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const existingUserId = result[0]?.id;
  if (existingUserId) return existingUserId;

  const inserted = await db
    .insert(users)
    .values({
      email,
      name: session.user?.name ?? email.split("@")[0],
    })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });

  const insertedUserId = inserted[0]?.id;
  if (insertedUserId) return insertedUserId;

  const retried = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return retried[0]?.id ?? null;
}
