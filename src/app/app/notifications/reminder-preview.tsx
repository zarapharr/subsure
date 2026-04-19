"use client";

import { useState } from "react";

type ReminderPreviewProps = {
  recipientEmail: string;
  unsubscribePath: string;
};

function formatPreviewTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ReminderPreview({ recipientEmail, unsubscribePath }: ReminderPreviewProps) {
  const [previewGeneratedAtIso, setPreviewGeneratedAtIso] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Reminder trigger preview</h2>
        <p className="text-sm text-slate-600">
          This preview renders the reminder content in-app and does not send a real email.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setPreviewGeneratedAtIso(new Date().toISOString())}
        className="mt-4 inline-flex justify-center rounded-md border border-slate-300 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Generate reminder preview
      </button>

      {previewGeneratedAtIso ? (
        <article className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p>
            Preview generated at <strong>{formatPreviewTimestamp(previewGeneratedAtIso)}</strong>
          </p>
          <p className="mt-2">
            <strong>To:</strong> {recipientEmail}
          </p>
          <p>
            <strong>Subject:</strong> Upcoming subscription renewal reminder
          </p>
          <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
            <p>Hello,</p>
            <p className="mt-2">
              You have subscriptions with upcoming renewals. Open SubSure to review keep/cancel choices before the
              next charge.
            </p>
            <p className="mt-2">
              <a href={unsubscribePath} className="underline underline-offset-2">
                Unsubscribe from reminder emails
              </a>
            </p>
          </div>
        </article>
      ) : null}
    </section>
  );
}
