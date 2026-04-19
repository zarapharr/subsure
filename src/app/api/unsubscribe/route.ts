import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { notificationPreferences, users } from "@/db/schema";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const token =
    payload && typeof payload === "object" && "token" in payload && typeof payload.token === "string"
      ? payload.token
      : null;

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const verified = verifyUnsubscribeToken(token);
  if (!verified.valid) {
    return NextResponse.json({ error: `Invalid token: ${verified.reason}` }, { status: 400 });
  }

  const { userId, email } = verified.payload;

  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.email, email)))
    .limit(1);

  if (!userRows[0]) {
    return NextResponse.json({ error: "Unsubscribe token does not match an active user" }, { status: 404 });
  }

  const now = new Date();

  await db
    .insert(notificationPreferences)
    .values({
      userId,
      reminderChannel: "none",
      reminderFrequency: "weekly",
      unsubscribedAt: now,
      unsubscribeReason: "unsubscribe_link",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: {
        reminderChannel: "none",
        unsubscribedAt: now,
        unsubscribeReason: "unsubscribe_link",
        updatedAt: now,
      },
    });

  return NextResponse.json({ ok: true });
}
