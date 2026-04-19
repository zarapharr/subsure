import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { notificationPreferences } from "@/db/schema";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

async function unsubscribeAction(formData: FormData) {
  "use server";

  const tokenRaw = formData.get("token");
  const token = typeof tokenRaw === "string" ? tokenRaw : "";
  const verification = verifyUnsubscribeToken(token);

  if (!verification.valid) {
    redirect(`/unsubscribe?token=${encodeURIComponent(token)}&done=0`);
  }

  const now = new Date();

  await db
    .insert(notificationPreferences)
    .values({
      userId: verification.payload.userId,
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

  redirect(`/unsubscribe?token=${encodeURIComponent(token)}&done=1`);
}

type UnsubscribePageProps = {
  searchParams?: {
    token?: string;
    done?: string;
  };
};

export default function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const token = searchParams?.token ?? "";
  const done = searchParams?.done;
  const verification = token ? verifyUnsubscribeToken(token) : { valid: false as const, reason: "malformed" as const };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-5 px-4 py-10 sm:px-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reminder email unsubscribe</h1>

        {done === "1" ? (
          <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            You are unsubscribed from reminder emails.
          </p>
        ) : null}

        {!verification.valid ? (
          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Invalid or expired unsubscribe link.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-slate-600">
              This will disable all reminder-email notifications for <strong>{verification.payload.email}</strong>.
            </p>
            <form action={unsubscribeAction} className="mt-5">
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="inline-flex justify-center rounded-md border border-slate-300 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Confirm unsubscribe
              </button>
            </form>
          </>
        )}

        <div className="mt-6">
          <Link href="/" className="text-sm font-medium text-slate-900 underline underline-offset-2">
            Return to SubSure
          </Link>
        </div>
      </section>
    </main>
  );
}
