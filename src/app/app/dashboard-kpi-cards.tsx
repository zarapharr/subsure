import type { DashboardKpiSummary } from "@/lib/dashboard-kpis";
import { formatUsdFromCents } from "@/lib/dashboard-kpis";

type DashboardKpiCardsProps = {
  summary: DashboardKpiSummary;
  renewalWindowDays?: number;
};

export function DashboardKpiCards({ summary, renewalWindowDays = 30 }: DashboardKpiCardsProps) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Monthly recurring spend</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {formatUsdFromCents(summary.monthlyRecurringSpendCents)}
        </p>
        <p className="mt-1 text-xs text-slate-600">Estimated monthly commitment from active recurring charges.</p>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Annual recurring spend</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {formatUsdFromCents(summary.annualRecurringSpendCents)}
        </p>
        <p className="mt-1 text-xs text-slate-600">Estimated yearly memberships and renewals currently detected.</p>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Renewals in next {renewalWindowDays} days
        </p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{summary.upcomingRenewalsCount}</p>
        <p className="mt-1 text-xs text-slate-600">
          {formatUsdFromCents(summary.upcomingRenewalsAmountCents)} expected to bill in the near-term window.
        </p>
      </article>

      <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-800">Cancellation opportunities</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-amber-950 sm:text-3xl">{summary.cancellationOpportunityCount}</p>
        <p className="mt-1 text-xs text-amber-900">
          {formatUsdFromCents(summary.monthlySpendAtRiskCents)} monthly +{" "}
          {formatUsdFromCents(summary.annualSpendAtRiskCents)} annual spend tagged for cancel or downgrade.
        </p>
      </article>
    </section>
  );
}
