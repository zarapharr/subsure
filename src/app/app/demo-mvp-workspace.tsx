"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardKpiCards } from "./dashboard-kpi-cards";
import { DashboardListModuleCards } from "./dashboard-list-modules";
import { ValidationQueue } from "./validation-queue";
import { buildDashboardKpiSummary } from "@/lib/dashboard-kpis";
import { buildDashboardListModules } from "@/lib/dashboard-list-modules";
import { MOCK_VALIDATION_CARDS, type ValidationCard } from "@/lib/validation-queue";

type PlaidStatusResponse = {
  plaidEnabled: boolean;
  plaidEnvironment: "sandbox" | "development" | "production";
  linkedItems: number;
  linkedAccounts: number;
  ingestionMode: "plaid" | "manual";
};

type LinkTokenResponse = {
  linkToken: string;
};

type PlaidCreateConfig = {
  token: string;
  onSuccess: (publicToken: string, metadata: { institution?: { name?: string } | null }) => void | Promise<void>;
  onExit?: (error: unknown) => void;
};

type PlaidHandler = {
  open: () => void;
};

type PlaidBrowserApi = {
  create: (config: PlaidCreateConfig) => PlaidHandler;
};

type WindowWithPlaid = Window & {
  Plaid?: PlaidBrowserApi;
};

type DemoMvpWorkspaceProps = {
  displayName: string;
};

async function ensurePlaidScriptLoaded() {
  const win = window as WindowWithPlaid;
  if (win.Plaid) return;

  await new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-plaid-link="true"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Plaid script")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.async = true;
    script.dataset.plaidLink = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Plaid script"));
    document.body.appendChild(script);
  });
}

export function DemoMvpWorkspace({ displayName }: DemoMvpWorkspaceProps) {
  const [plaidStatus, setPlaidStatus] = useState<PlaidStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [plaidConnectError, setPlaidConnectError] = useState<string | null>(null);
  const [isConnectingPlaid, setIsConnectingPlaid] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [queue, setQueue] = useState<ValidationCard[]>([]);

  const refreshPlaidStatus = useCallback(async () => {
    setStatusError(null);
    try {
      const response = await fetch("/api/plaid/status", { method: "GET" });
      if (!response.ok) throw new Error("Failed to load Plaid status");
      const data = (await response.json()) as PlaidStatusResponse;
      setPlaidStatus(data);
    } catch {
      setStatusError("Unable to load Plaid connection status.");
    }
  }, []);

  useEffect(() => {
    void refreshPlaidStatus();
  }, [refreshPlaidStatus]);

  const isPlaidLinked = (plaidStatus?.linkedItems ?? 0) > 0;
  const shouldUnlockDemo = isDemoMode || isPlaidLinked;

  useEffect(() => {
    if (shouldUnlockDemo) {
      setQueue(MOCK_VALIDATION_CARDS);
      return;
    }
    setQueue([]);
  }, [shouldUnlockDemo]);

  const kpiSummary = useMemo(() => buildDashboardKpiSummary(queue), [queue]);
  const listModules = useMemo(() => buildDashboardListModules(queue), [queue]);

  async function handleConnectPlaid() {
    setPlaidConnectError(null);
    setIsConnectingPlaid(true);
    setIsDemoMode(false);

    try {
      const linkTokenResponse = await fetch("/api/plaid/link-token", {
        method: "POST",
      });
      if (!linkTokenResponse.ok) {
        throw new Error("Could not create Plaid link token");
      }

      const payload = (await linkTokenResponse.json()) as LinkTokenResponse;
      await ensurePlaidScriptLoaded();

      const win = window as WindowWithPlaid;
      if (!win.Plaid) throw new Error("Plaid script not available");

      const handler = win.Plaid.create({
        token: payload.linkToken,
        onSuccess: async (publicToken, metadata) => {
          try {
            const exchangeResponse = await fetch("/api/plaid/exchange-public-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                publicToken,
                institutionName: metadata.institution?.name,
              }),
            });

            if (!exchangeResponse.ok) {
              throw new Error("Plaid account exchange failed");
            }

            await refreshPlaidStatus();
          } catch {
            setPlaidConnectError("Plaid account exchange failed. Use demo adapter mode if this keeps failing.");
          } finally {
            setIsConnectingPlaid(false);
          }
        },
        onExit: () => {
          setIsConnectingPlaid(false);
        },
      });

      handler.open();
    } catch {
      setPlaidConnectError(
        "Plaid Link failed to open. You can keep moving with demo mode and call out the Plaid step as a sandbox stub.",
      );
      setIsConnectingPlaid(false);
    }
  }

  return (
    <section className="space-y-5 sm:space-y-6">
      <article className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Bank Connection</h2>
        <p className="text-sm text-slate-700">
          Connect a Plaid Sandbox institution to unlock recurring-charge detection for the demo.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
          <li>Institution: any Sandbox test institution</li>
          <li>Username: `user_good`</li>
          <li>Password: `pass_good`</li>
        </ul>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleConnectPlaid}
            disabled={isConnectingPlaid}
            className="rounded-md border border-slate-300 bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {isConnectingPlaid ? "Opening Plaid Link..." : "Connect Plaid Sandbox"}
          </button>
          <button
            type="button"
            onClick={() => setIsDemoMode(true)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            Continue with Demo Adapter
          </button>
        </div>

        {statusError ? <p className="text-sm text-rose-700">{statusError}</p> : null}
        {plaidConnectError ? <p className="text-sm text-rose-700">{plaidConnectError}</p> : null}

        <p className="text-xs text-slate-600">
          Status:{" "}
          <span className="font-medium text-slate-800">
            {shouldUnlockDemo ? "Connected for demo" : "Not connected"}
          </span>
          {plaidStatus ? ` · Plaid env: ${plaidStatus.plaidEnvironment}` : ""}
          {isDemoMode ? " · using demo adapter data" : ""}
        </p>
      </article>

      <DashboardKpiCards summary={kpiSummary} />
      <DashboardListModuleCards modules={listModules} />

      {shouldUnlockDemo ? (
        <ValidationQueue
          key={isDemoMode ? "validation-queue-demo-adapter" : "validation-queue-plaid"}
          displayName={displayName}
          initialQueue={MOCK_VALIDATION_CARDS}
          onQueueChange={setQueue}
        />
      ) : (
        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 sm:p-5">
          Connect a sandbox institution (or use the demo adapter) to load recurring subscription candidates into the
          validation queue.
        </article>
      )}
    </section>
  );
}
