import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  buildDashboardListModules,
  type RenewalConfidenceBand,
  type RenewalTimelineItem,
  type RenewalTimelineSort,
} from "@/lib/dashboard-list-modules";
import { formatUsdFromCents } from "@/lib/dashboard-kpis";
import { MOCK_VALIDATION_CARDS } from "@/lib/validation-queue";

const HORIZON_OPTIONS = [30, 60, 90, 180, 365] as const;

const SORT_OPTIONS: ReadonlyArray<{ id: RenewalTimelineSort; label: string }> = [
  { id: "soonest", label: "Soonest first" },
  { id: "latest", label: "Latest first" },
  { id: "amount_desc", label: "Highest amount" },
  { id: "amount_asc", label: "Lowest amount" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getDateBucket(iso: string): string {
  return iso.slice(0, 10);
}

function parseHorizon(value?: string | string[]): number {
  if (typeof value !== "string") return 90;
  const parsed = Number.parseInt(value, 10);
  return HORIZON_OPTIONS.includes(parsed as (typeof HORIZON_OPTIONS)[number]) ? parsed : 90;
}

function parseSort(value?: string | string[]): RenewalTimelineSort {
  if (typeof value !== "string") return "soonest";
  const isKnownSort = SORT_OPTIONS.some((option) => option.id === value);
  return isKnownSort ? (value as RenewalTimelineSort) : "soonest";
}

function buildFilterHref(nextHorizon: number, nextSort: RenewalTimelineSort): string {
  const searchParams = new URLSearchParams({
    horizon: String(nextHorizon),
    sort: nextSort,
  });
  return `/app/timeline?${searchParams.toString()}`;
}

function confidenceBadgeClassName(confidenceBand: RenewalConfidenceBand): string {
  if (confidenceBand === "high") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
  if (confidenceBand === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-rose-200 bg-rose-50 text-rose-900";
}

type TimelinePageProps = {
  searchParams?: {
    horizon?: string | string[];
    sort?: string | string[];
  };
};

function groupTimelineByDate(items: RenewalTimelineItem[]): Array<{ dateKey: string; items: RenewalTimelineItem[] }> {
  const grouped = new Map<string, RenewalTimelineItem[]>();

  for (const item of items) {
    const dateKey = getDateBucket(item.nextRenewalIso);
    const bucket = grouped.get(dateKey);
    if (bucket) {
      bucket.push(item);
      continue;
    }
    grouped.set(dateKey, [item]);
  }

  return Array.from(grouped.entries()).map(([dateKey, groupedItems]) => ({
    dateKey,
    items: groupedItems,
  }));
}

export default async function TimelinePage({ searchParams }: TimelinePageProps) {
  const session = await auth();
  if (!session) redirect("/login");

  const horizonDays = parseHorizon(searchParams?.horizon);
  const sort = parseSort(searchParams?.sort);

  const modules = buildDashboardListModules(MOCK_VALIDATION_CARDS, {
    renewalWindowDays: horizonDays,
    renewalSort: sort,
    renewalLimit: MOCK_VALIDATION_CARDS.length,
  });

  const groupedTimeline = groupTimelineByDate(modules.renewalTimeline);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6 sm:py-10 lg:px-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Renewal Timeline</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Upcoming renewal schedule</h1>
        <p className="text-sm text-slate-600">
          Prioritize renewals due soon, then jump into validation for any subscription that needs a decision.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/app" className="text-sm font-medium text-slate-900 underline underline-offset-2">
            Back to dashboard
          </Link>
          <Link href="/app/validation" className="text-sm font-medium text-slate-900 underline underline-offset-2">
            Open validation queue
          </Link>
        </div>
      </header>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Next {horizonDays} days</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex flex-wrap gap-1">
              {HORIZON_OPTIONS.map((option) => {
                const isActive = option === horizonDays;
                return (
                  <Link
                    key={option}
                    href={buildFilterHref(option, sort)}
                    className={`rounded-md border px-2 py-1 text-xs font-medium ${
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    {option}d
                  </Link>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1">
              {SORT_OPTIONS.map((option) => {
                const isActive = option.id === sort;
                return (
                  <Link
                    key={option.id}
                    href={buildFilterHref(horizonDays, option.id)}
                    className={`rounded-md border px-2 py-1 text-xs font-medium ${
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {groupedTimeline.length > 0 ? (
          <div className="space-y-3">
            {groupedTimeline.map((group) => (
              <section key={group.dateKey} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  {formatDate(`${group.dateKey}T00:00:00.000Z`)}
                </h3>
                <ul className="space-y-2">
                  {group.items.map((item) => (
                    <li
                      key={item.cardId}
                      className="flex flex-col items-start justify-between gap-1 rounded-lg border border-slate-200 px-3 py-2 sm:flex-row sm:items-center sm:gap-2"
                    >
                      <div className="w-full">
                        <p className="font-medium text-slate-900">{item.merchant}</p>
                        <p className="text-xs text-slate-600 capitalize">{item.cadence} renewal</p>
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
                      </div>
                      <p className="font-medium text-slate-900">{formatUsdFromCents(item.amountCents)}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-700">No renewals scheduled in the next {horizonDays} days.</p>
        )}
      </section>
    </main>
  );
}
