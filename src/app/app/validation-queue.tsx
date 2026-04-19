"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MOCK_VALIDATION_CARDS,
  VALIDATION_DECISIONS,
  getDecisionById,
  resolveDecisionFromKey,
  type ValidationCard,
  type ValidationDecisionId,
  type ValidationHistoryEntry,
} from "@/lib/validation-queue";
import { toValidationHistoryEntry, type ValidationDecisionRecord } from "@/lib/validation-decisions";

function formatCurrency(amountCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

function formatDate(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

type ValidationQueueProps = {
  displayName: string;
  initialQueue?: ValidationCard[];
  onQueueChange?: (queue: ValidationCard[]) => void;
};

export function ValidationQueue({ displayName, initialQueue = MOCK_VALIDATION_CARDS, onQueueChange }: ValidationQueueProps) {
  const [queue, setQueue] = useState<ValidationCard[]>(initialQueue);
  const [history, setHistory] = useState<ValidationHistoryEntry[]>([]);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedHistoryByCardId, setExpandedHistoryByCardId] = useState<Record<string, boolean>>({});
  const [duplicateMergeTargetByCardId, setDuplicateMergeTargetByCardId] = useState<Record<string, string>>({});

  const currentCard = queue[0] ?? null;

  const progress = useMemo(() => {
    const total = queue.length + history.length;
    const completed = history.length;

    return {
      total,
      completed,
      remaining: queue.length,
      pct: total === 0 ? 100 : Math.round((completed / total) * 100),
    };
  }, [history.length, queue.length]);

  const submitDecision = useCallback(
    async (decisionId: ValidationDecisionId) => {
      const activeCard = queue[0];
      if (!activeCard || isSubmitting) return;

      const mergeIntoCardId =
        decisionId === "duplicate"
          ? duplicateMergeTargetByCardId[activeCard.id] ?? activeCard.duplicateMergeTargets?.[0]?.cardId ?? null
          : null;

      const decidedAtIso = new Date().toISOString();
      const optimisticEntry: ValidationHistoryEntry = {
        cardId: activeCard.id,
        merchant: activeCard.merchant,
        decisionId,
        decidedAtIso,
        mergeIntoCardId,
      };

      setPersistError(null);
      setIsSubmitting(true);

      setHistory((existing) => [optimisticEntry, ...existing]);
      setQueue((existing) => existing.slice(1));

      try {
        const response = await fetch("/api/validation-decisions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cardId: activeCard.id,
            merchant: activeCard.merchant,
            decisionId,
            amountCents: activeCard.amountCents,
            cadence: activeCard.cadence,
            decidedAtIso,
            mergeIntoCardId,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to persist decision");
        }
      } catch {
        setQueue((existing) => [activeCard, ...existing]);
        setHistory((existing) =>
          existing.filter(
            (entry) =>
              !(
                entry.cardId === optimisticEntry.cardId &&
                entry.decisionId === optimisticEntry.decisionId &&
                entry.decidedAtIso === optimisticEntry.decidedAtIso
              ),
          ),
        );
        setPersistError("Decision was not saved. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [duplicateMergeTargetByCardId, isSubmitting, queue],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPersistedHistory() {
      try {
        const response = await fetch("/api/validation-decisions?limit=10", { method: "GET" });
        if (!response.ok) return;
        const data = (await response.json()) as { decisions?: ValidationDecisionRecord[] };
        if (cancelled || !Array.isArray(data.decisions)) return;
        setHistory(data.decisions.map(toValidationHistoryEntry));
      } catch {
        // Keep local UX functional even when persisted history fails to load.
      }
    }

    void loadPersistedHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onQueueChange?.(queue);
  }, [onQueueChange, queue]);

  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if (!currentCard || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName.toLowerCase();
        const isEditable = tagName === "input" || tagName === "textarea" || target.isContentEditable;
        if (isEditable) return;
      }

      const decisionId = resolveDecisionFromKey(event.key);
      if (!decisionId) return;

      event.preventDefault();
      submitDecision(decisionId);
    }

    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [currentCard, submitDecision]);

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:space-y-6 sm:p-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Validation queue</p>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Decision flow for {displayName}</h2>
        <p className="text-sm text-slate-600">
          Confirm each recurring charge with the option that matches your situation. Use number keys `1-6` or letter
          shortcuts for faster keyboard flow.
        </p>
      </header>

      <div className="space-y-2">
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-slate-900 transition-[width] duration-200" style={{ width: `${progress.pct}%` }} />
        </div>
        <p className="text-xs text-slate-600">
          {progress.completed} decided · {progress.remaining} remaining · {progress.total} total
        </p>
      </div>

      {currentCard ? (
        <article className="space-y-5 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 sm:text-2xl">{currentCard.merchant}</h3>
              <p className="text-sm text-slate-600">{currentCard.accountLabel}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xl font-semibold text-slate-900 sm:text-2xl">{formatCurrency(currentCard.amountCents)}</p>
              <p className="text-sm text-slate-600">{currentCard.cadence}</p>
            </div>
          </div>

          <dl className="grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <dt className="font-medium text-slate-500">Last charged</dt>
              <dd>{formatDate(currentCard.lastChargedAt)}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <dt className="font-medium text-slate-500">Detection confidence</dt>
              <dd>{Math.round(currentCard.confidenceScore * 100)}%</dd>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <dt className="font-medium text-slate-500">Recommendation</dt>
              <dd className="font-medium text-slate-900">{getDecisionById(currentCard.recommendation).label}</dd>
            </div>
          </dl>

          <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
            <h4 className="font-medium text-slate-900">Why this is recommended</h4>
            <p>{currentCard.recommendationReason.summary}</p>
            <ul className="list-disc space-y-1 pl-5">
              {currentCard.recommendationReason.evidence.map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
            <p className="text-xs text-slate-600">{currentCard.recommendationReason.confidenceNote}</p>
            <p className="text-xs font-medium text-slate-700">
              Suggestions do not change anything automatically. You choose the final decision.
            </p>
          </section>

          <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-slate-900">Transaction history</h4>
              <button
                type="button"
                onClick={() =>
                  setExpandedHistoryByCardId((existing) => ({
                    ...existing,
                    [currentCard.id]: !existing[currentCard.id],
                  }))
                }
                className="text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-900"
              >
                {expandedHistoryByCardId[currentCard.id] ? "Collapse" : "Expand"}
              </button>
            </div>
            <ul className="space-y-2">
              {(expandedHistoryByCardId[currentCard.id]
                ? currentCard.transactionHistory
                : currentCard.transactionHistory.slice(0, 3)
              ).map((transaction) => (
                <li key={transaction.id} className="grid grid-cols-1 gap-1 rounded-md border border-slate-200 px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="font-medium text-slate-900">{formatDate(transaction.postedAt)}</p>
                    <p className="text-xs text-slate-600">{transaction.accountLabel}</p>
                  </div>
                  <p className="font-medium text-slate-900 sm:text-right">{formatCurrency(Math.abs(transaction.amountCents))}</p>
                </li>
              ))}
            </ul>
            {!expandedHistoryByCardId[currentCard.id] && currentCard.transactionHistory.length > 3 ? (
              <p className="text-xs text-slate-600">
                Showing 3 of {currentCard.transactionHistory.length} charges. Expand to review the full pattern.
              </p>
            ) : null}
          </section>

          {currentCard.duplicateMergeTargets && currentCard.duplicateMergeTargets.length > 0 ? (
            <section className="space-y-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
              <h4 className="font-medium">Duplicate / merge options</h4>
              <p className="text-xs">
                If you choose Duplicate, pick the record this card should merge into so we can keep one active
                subscription candidate.
              </p>
              <div className="space-y-2">
                {currentCard.duplicateMergeTargets.map((target) => {
                  const selectedId =
                    duplicateMergeTargetByCardId[currentCard.id] ?? currentCard.duplicateMergeTargets?.[0]?.cardId;

                  return (
                    <label
                      key={target.cardId}
                      className="flex cursor-pointer items-start gap-2 rounded-md border border-violet-200 bg-white px-3 py-2"
                    >
                      <input
                        type="radio"
                        name={`duplicate-merge-${currentCard.id}`}
                        value={target.cardId}
                        checked={selectedId === target.cardId}
                        onChange={(event) =>
                          setDuplicateMergeTargetByCardId((existing) => ({
                            ...existing,
                            [currentCard.id]: event.target.value,
                          }))
                        }
                        className="mt-1"
                      />
                      <span>
                        <span className="block font-medium">
                          {target.merchant} · {formatCurrency(target.amountCents)}
                        </span>
                        <span className="block text-xs text-violet-700">
                          {target.accountLabel} · last charged {formatDate(target.lastChargedAt)}
                        </span>
                        <span className="block text-xs text-violet-700">{target.reason}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {VALIDATION_DECISIONS.map((decision, idx) => (
              <button
                key={decision.id}
                type="button"
                onClick={() => submitDecision(decision.id)}
                disabled={isSubmitting}
                className={`rounded-lg border px-3 py-3 text-left transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60 ${decision.toneClassName}`}
              >
                <p className="text-sm font-semibold">
                  {decision.label} <span className="font-normal">({idx + 1}/{decision.shortcut.toUpperCase()})</span>
                </p>
                <p className="text-xs opacity-90">{decision.description}</p>
              </button>
            ))}
          </div>
          {persistError ? <p className="text-sm font-medium text-rose-700">{persistError}</p> : null}
        </article>
      ) : (
        <article className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
          <h3 className="text-xl font-semibold">Queue complete</h3>
          <p className="text-sm">All visible subscriptions have a decision. You can reset the demo queue to run it again.</p>
          <button
            type="button"
            onClick={() => {
              setQueue(initialQueue);
              setHistory([]);
              setExpandedHistoryByCardId({});
              setDuplicateMergeTargetByCardId({});
            }}
            className="inline-flex rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-medium hover:bg-emerald-100"
          >
            Reset demo queue
          </button>
        </article>
      )}

      {history.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent decisions</h3>
          <ul className="space-y-2 text-sm">
            {history.slice(0, 5).map((entry) => (
              <li key={`${entry.cardId}-${entry.decidedAtIso}`} className="rounded-lg border border-slate-200 bg-white p-3 break-words">
                <span className="font-medium text-slate-900">{entry.merchant}</span>
                <span className="text-slate-600"> marked as </span>
                <span className="font-medium text-slate-900">{getDecisionById(entry.decisionId).label}</span>
                {entry.decisionId === "duplicate" && entry.mergeIntoCardId ? (
                  <>
                    <span className="text-slate-600"> and merged into </span>
                    <span className="font-medium text-slate-900">{entry.mergeIntoCardId}</span>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
