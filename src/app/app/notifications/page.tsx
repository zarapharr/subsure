import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { notificationPreferences, users } from "@/db/schema";
import {
  normalizeNotificationPreferences,
  REMINDER_FREQUENCIES,
  type ReminderFrequency,
  updateNotificationPreferencesSchema,
} from "@/lib/notification-preferences";
import { createUnsubscribeToken } from "@/lib/unsubscribe-token";
import { ReminderPreview } from "./reminder-preview";

const FREQUENCY_LABELS: Record<ReminderFrequency, string> = {
  immediate: "Immediate (every eligible reminder)",
  daily: "Daily digest-style spacing",
  weekly: "Weekly minimum spacing",
};

async function updatePreferencesAction(formData: FormData) {
  "use server";

  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const userId = userRows[0]?.id;
  if (!userId) redirect("/login");

  const parsed = updateNotificationPreferencesSchema.safeParse({
    reminderChannel: formData.get("reminderChannel"),
    reminderFrequency: formData.get("reminderFrequency"),
  });

  if (!parsed.success) {
    redirect("/app/notifications?saved=0");
  }

  const now = new Date();
  const unsubscribedAt = parsed.data.reminderChannel === "none" ? now : null;

  await db
    .insert(notificationPreferences)
    .values({
      userId,
      reminderChannel: parsed.data.reminderChannel,
      reminderFrequency: parsed.data.reminderFrequency,
      unsubscribedAt,
      unsubscribeReason:
        parsed.data.reminderChannel === "none" ? "settings_page_opt_out" : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: {
        reminderChannel: parsed.data.reminderChannel,
        reminderFrequency: parsed.data.reminderFrequency,
        unsubscribedAt,
        unsubscribeReason:
          parsed.data.reminderChannel === "none" ? "settings_page_opt_out" : null,
        updatedAt: now,
      },
    });

  redirect("/app/notifications?saved=1");
}

type NotificationsPageProps = {
  searchParams?: {
    saved?: string;
  };
};

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const userRows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = userRows[0];
  if (!user?.id || !user.email) redirect("/login");

  const preferenceRows = await db
    .select({
      reminderChannel: notificationPreferences.reminderChannel,
      reminderFrequency: notificationPreferences.reminderFrequency,
      unsubscribedAt: notificationPreferences.unsubscribedAt,
    })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, user.id))
    .limit(1);

  const preferences = normalizeNotificationPreferences({
    reminderChannel: preferenceRows[0]?.reminderChannel as "email" | "none" | undefined,
    reminderFrequency: preferenceRows[0]?.reminderFrequency as ReminderFrequency | undefined,
    unsubscribedAtIso: preferenceRows[0]?.unsubscribedAt
      ? preferenceRows[0].unsubscribedAt.toISOString()
      : null,
  });

  const unsubscribeToken = createUnsubscribeToken({
    userId: user.id,
    email: user.email,
  });

  const saved = searchParams?.saved;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Reminder Preferences</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Notification controls
        </h1>
        <p className="text-sm text-slate-600">
          Choose how often SubSure contacts you about upcoming renewals and pending validation reminders.
        </p>
        <Link href="/app" className="text-sm font-medium text-slate-900 underline underline-offset-2">
          Back to dashboard
        </Link>
      </header>

      {saved === "1" ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Preferences saved.
        </p>
      ) : null}

      <form action={updatePreferencesAction} className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Delivery channel</h2>
          <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3">
            <input
              type="radio"
              name="reminderChannel"
              value="email"
              defaultChecked={preferences.reminderChannel === "email"}
              className="mt-1"
            />
            <span className="text-sm text-slate-700">Email reminders enabled</span>
          </label>
          <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3">
            <input
              type="radio"
              name="reminderChannel"
              value="none"
              defaultChecked={preferences.reminderChannel === "none"}
              className="mt-1"
            />
            <span className="text-sm text-slate-700">Pause all reminder emails</span>
          </label>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Frequency</h2>
          <div className="space-y-2">
            {REMINDER_FREQUENCIES.map((frequency) => (
              <label key={frequency} className="flex items-start gap-3 rounded-md border border-slate-200 p-3">
                <input
                  type="radio"
                  name="reminderFrequency"
                  value={frequency}
                  defaultChecked={preferences.reminderFrequency === frequency}
                  className="mt-1"
                />
                <span className="text-sm text-slate-700">{FREQUENCY_LABELS[frequency]}</span>
              </label>
            ))}
          </div>
        </section>

        <button
          type="submit"
          className="inline-flex justify-center rounded-md border border-slate-300 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Save preferences
        </button>
      </form>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-base font-semibold text-slate-900">Email footer opt-out link</h2>
        <p className="mt-2 text-sm text-slate-600">
          This is the same signed unsubscribe URL that can be included in reminder emails.
        </p>
        <p className="mt-3 break-all text-sm text-slate-700">
          {`/unsubscribe?token=${unsubscribeToken}`}
        </p>
      </section>

      <ReminderPreview
        recipientEmail={user.email}
        unsubscribePath={`/unsubscribe?token=${unsubscribeToken}`}
      />
    </main>
  );
}
