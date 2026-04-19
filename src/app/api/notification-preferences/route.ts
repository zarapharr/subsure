import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { notificationPreferences } from "@/db/schema";
import { resolveAuthedUserId } from "@/lib/authed-user";
import { normalizeNotificationPreferences, updateNotificationPreferencesSchema } from "@/lib/notification-preferences";

function toResponse(row?: {
  reminderChannel: string;
  reminderFrequency: string;
  unsubscribedAt: Date | null;
}) {
  return normalizeNotificationPreferences({
    reminderChannel: row?.reminderChannel as "email" | "none" | undefined,
    reminderFrequency: row?.reminderFrequency as "immediate" | "daily" | "weekly" | undefined,
    unsubscribedAtIso: row?.unsubscribedAt ? row.unsubscribedAt.toISOString() : null,
  });
}

export async function GET() {
  const userId = await resolveAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      reminderChannel: notificationPreferences.reminderChannel,
      reminderFrequency: notificationPreferences.reminderFrequency,
      unsubscribedAt: notificationPreferences.unsubscribedAt,
    })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  return NextResponse.json({ preferences: toResponse(rows[0]) });
}

export async function PUT(request: Request) {
  const userId = await resolveAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = updateNotificationPreferencesSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const now = new Date();
  const channel = parsed.data.reminderChannel;
  const unsubscribedAt = channel === "none" ? now : null;

  const rows = await db
    .insert(notificationPreferences)
    .values({
      userId,
      reminderChannel: channel,
      reminderFrequency: parsed.data.reminderFrequency,
      unsubscribedAt,
      unsubscribeReason: channel === "none" ? "settings_page_opt_out" : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: {
        reminderChannel: channel,
        reminderFrequency: parsed.data.reminderFrequency,
        unsubscribedAt,
        unsubscribeReason: channel === "none" ? "settings_page_opt_out" : null,
        updatedAt: now,
      },
    })
    .returning({
      reminderChannel: notificationPreferences.reminderChannel,
      reminderFrequency: notificationPreferences.reminderFrequency,
      unsubscribedAt: notificationPreferences.unsubscribedAt,
    });

  return NextResponse.json({ preferences: toResponse(rows[0]) });
}
