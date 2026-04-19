import Link from "next/link";
import { formatUsdFromCents } from "@/lib/dashboard-kpis";
import type { DashboardListModules, RenewalConfidenceBand } from "@/lib/dashboard-list-modules";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

type DashboardListModulesProps = {
  modules: DashboardListModules;
};

function confidenceBadgeClassName(confidenceBand: RenewalConfidenceBand): string {
  if (confidenceBand === "high") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
  if (confidenceBand === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-rose-200 bg-rose-50 text-rose-900";
}

export function DashboardListModuleCards({ modules }: DashboardListModulesProps) {
  return (
    <section className="grid gap-4 lg:grid-cols-2 lg:gap-5">
      <article className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center sm:gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-900">At-risk subscriptions</h2>
          <Link
            href="/app/validation"
            className="text-xs font-semibold text-amber-900 underline underline-offset-2 sm:whitespace-nowrap"
          >
            Open validation queue
          </Link>
        </div>

        {modules.atRiskSubscriptions.length > 0 ? (
          <ul className="space-y-2">
            {modules.atRiskSubscriptions.map((item) => (
              <li key={item.cardId} className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                <div className="flex flex-col items-start justify-between gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <p className="font-medium text-slate-900">{item.merchant}</p>
                  <p className="text-sm font-medium text-slate-900">{formatUsdFromCents(item.amountCents)}</p>
                </div>
                <p className="text-xs capitalize text-slate-700">
                  {item.recommendation} · {item.cadence}
                </p>
                <p className="mt-1 text-xs text-slate-600">{item.reasonSummary}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-700">
            No at-risk subscriptions detected right now.
          </p>
        )}
      </article>

      <article className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center sm:gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-sky-900">Upcoming renewals</h2>
          <Link
            href="/app/timeline"
            className="text-xs font-semibold text-sky-900 underline underline-offset-2 sm:whitespace-nowrap"
          >
            Open renewal timeline
          </Link>
        </div>

        {modules.renewalTimeline.length > 0 ? (
          <ul className="space-y-2">
            {modules.renewalTimeline.map((item) => (
              <li key={item.cardId} className="rounded-lg border border-sky-200 bg-white px-3 py-2">
                <div className="flex flex-col items-start justify-between gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <p className="font-medium text-slate-900">{item.merchant}</p>
                  <p className="text-sm font-medium text-slate-900">{formatUsdFromCents(item.amountCents)}</p>
                </div>
                <p className="text-xs text-slate-700">Renews {formatDate(item.nextRenewalIso)}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-900">
                    Suggested action: {item.suggestedActionLabel}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${confidenceBadgeClassName(item.confidenceBand)}`}
                  >
                    {item.confidenceBand} confidence ({Math.round(item.confidenceScore * 100)}%)
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">{item.suggestedActionSummary}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-slate-700">
            No renewals due inside the active timeline window.
          </p>
        )}
      </article>
    </section>
  );
}
