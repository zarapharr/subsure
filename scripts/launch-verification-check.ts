import "dotenv/config";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type CheckResult = {
  name: string;
  passed: boolean;
  details: string;
};

type RequestResult = {
  ok: boolean;
  status: number;
  body: JsonValue;
};

type RequestJsonFn = (input: string, init: RequestInit, timeoutMs: number) => Promise<RequestResult>;

const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "PLAID_CLIENT_ID",
  "PLAID_SECRET",
  "PLAID_ENV",
  "PLAID_REFRESH_CRON_SECRET",
] as const;

const USAGE = [
  "Usage:",
  "  npm run verify:launch -- [--app-url <url>] [--auth-cookie '<name=value; ...>'] [--cron-secret <secret>]",
  "    [--expected-plaid-env development] [--timeout-ms 15000] [--skip-env-check] [--mock-mode]",
  "",
  "Defaults:",
  "  --app-url: NEXTAUTH_URL, falling back to http://localhost:3000",
  "  --auth-cookie: VERIFY_LAUNCH_AUTH_COOKIE (if set); otherwise required",
  "  --cron-secret: PLAID_REFRESH_CRON_SECRET",
  "  --expected-plaid-env: development",
  "  --timeout-ms: 15000",
  "  --mock-mode: run endpoint-shape smoke checks with in-memory mock responses",
].join("\n");

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  const flags = new Set<string>();

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) continue;
    if (!token.startsWith("--")) continue;

    const raw = token.slice(2);
    const equalIndex = raw.indexOf("=");
    if (equalIndex > 0) {
      args.set(raw.slice(0, equalIndex), raw.slice(equalIndex + 1));
      continue;
    }

    const key = raw;
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      flags.add(key);
      continue;
    }

    args.set(key, next);
    i += 1;
  }

  return { args, flags };
}

function printUsage(): void {
  console.log(USAGE);
}

function requireKnownOptions(args: Map<string, string>, flags: Set<string>): void {
  const knownArgs = new Set(["app-url", "auth-cookie", "cron-secret", "expected-plaid-env", "timeout-ms"]);
  const knownFlags = new Set(["help", "skip-env-check", "mock-mode"]);

  for (const key of args.keys()) {
    if (!knownArgs.has(key)) {
      throw new Error(`Unknown option --${key}. Run with --help for usage.`);
    }
  }

  for (const key of flags.values()) {
    if (!knownFlags.has(key)) {
      throw new Error(`Unknown flag --${key}. Run with --help for usage.`);
    }
  }
}

function getRequiredAuthCookie(args: Map<string, string>): string {
  const fromArg = args.get("auth-cookie");
  const fromEnv = process.env.VERIFY_LAUNCH_AUTH_COOKIE;
  const value = fromArg ?? fromEnv;
  if (!value || value.trim().length === 0) {
    throw new Error(
      "Missing auth cookie. Provide --auth-cookie '<name=value; ...>' or set VERIFY_LAUNCH_AUTH_COOKIE.",
    );
  }
  return value;
}

function normalizeUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function asRecord(value: JsonValue | undefined): Record<string, JsonValue> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, JsonValue>;
}

function asString(value: JsonValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: JsonValue | undefined): number | null {
  return typeof value === "number" ? value : null;
}

function asBoolean(value: JsonValue | undefined): boolean | null {
  return typeof value === "boolean" ? value : null;
}

async function requestJson(input: string, init: RequestInit, timeoutMs: number): Promise<RequestResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...init.headers,
      },
    });

    const text = await response.text();
    let body: JsonValue = null;

    if (text.length > 0) {
      try {
        body = JSON.parse(text) as JsonValue;
      } catch {
        body = { raw: text };
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      body,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function createMockRequester(expectedPlaidEnv: string): RequestJsonFn {
  let reminderChannel = "email";
  let reminderFrequency = "weekly";

  return async (input: string, init: RequestInit, _timeoutMs: number): Promise<RequestResult> => {
    const url = new URL(input);
    const method = (init.method ?? "GET").toUpperCase();

    if (url.pathname === "/api/session" && method === "GET") {
      return {
        ok: true,
        status: 200,
        body: {
          session: {
            user: {
              id: "mock-user",
              email: "mock-user@example.com",
            },
          },
        },
      };
    }

    if (url.pathname === "/api/plaid/status" && method === "GET") {
      return {
        ok: true,
        status: 200,
        body: {
          plaidEnabled: true,
          plaidEnvironment: expectedPlaidEnv,
          reconnectRequiredItems: 0,
        },
      };
    }

    if (url.pathname === "/api/plaid/refresh" && method === "POST") {
      return {
        ok: true,
        status: 200,
        body: {
          refreshedItems: 1,
          results: [{ status: "ok" }],
        },
      };
    }

    if (url.pathname === "/api/notification-preferences" && method === "GET") {
      return {
        ok: true,
        status: 200,
        body: {
          preferences: {
            reminderChannel,
            reminderFrequency,
          },
        },
      };
    }

    if (url.pathname === "/api/notification-preferences" && method === "PUT") {
      const parsedBody = typeof init.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};

      if (typeof parsedBody.reminderChannel === "string") {
        reminderChannel = parsedBody.reminderChannel;
      }
      if (typeof parsedBody.reminderFrequency === "string") {
        reminderFrequency = parsedBody.reminderFrequency;
      }

      return {
        ok: true,
        status: 200,
        body: {
          preferences: {
            reminderChannel,
            reminderFrequency,
          },
        },
      };
    }

    if (url.pathname === "/api/cron/plaid-refresh" && method === "POST") {
      return {
        ok: true,
        status: 200,
        body: {
          skipped: true,
          refreshedItems: 0,
          errorCount: 0,
        },
      };
    }

    return {
      ok: false,
      status: 404,
      body: {
        error: `mock-mode has no route for ${method} ${url.pathname}`,
      },
    };
  };
}

function printCheck(result: CheckResult) {
  const status = result.passed ? "PASS" : "FAIL";
  console.log(`[${status}] ${result.name}`);
  for (const line of result.details.split("\n")) {
    console.log(`  ${line}`);
  }
}

function summarizeAndExit(results: CheckResult[]) {
  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;

  console.log("\nLaunch verification summary");
  console.log("==========================");
  console.log(`Checks passed: ${passed}/${results.length}`);

  if (failed === 0) {
    console.log("Final result: PASS");
    process.exit(0);
  }

  console.log(`Checks failed: ${failed}`);
  console.log("Final result: FAIL");
  process.exit(1);
}

async function main() {
  const { args, flags } = parseArgs(process.argv.slice(2));
  requireKnownOptions(args, flags);

  if (flags.has("help")) {
    printUsage();
    process.exit(0);
  }

  const appUrl = normalizeUrl(args.get("app-url") ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000");
  const mockMode = flags.has("mock-mode");
  const authCookie = mockMode ? "mock-session=true" : getRequiredAuthCookie(args);
  const cronSecret = args.get("cron-secret") ?? process.env.PLAID_REFRESH_CRON_SECRET ?? "";
  const expectedPlaidEnv = args.get("expected-plaid-env") ?? "development";
  const timeoutMs = Number(args.get("timeout-ms") ?? "15000");
  const skipEnvCheck = flags.has("skip-env-check");
  const request = mockMode ? createMockRequester(expectedPlaidEnv) : requestJson;

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("--timeout-ms must be a positive number");
  }

  const checks: CheckResult[] = [];

  if (mockMode) {
    const result = {
      name: "Mock mode",
      passed: true,
      details: "using in-memory mock responses; credential/env presence is not required",
    };
    checks.push(result);
    printCheck(result);
  } else if (!skipEnvCheck) {
    const missing = REQUIRED_ENV_VARS.filter((key) => {
      const value = process.env[key];
      return !value || value.trim().length === 0;
    });

    const plaidEnv = process.env.PLAID_ENV;
    const plaidEnvMatches = plaidEnv === expectedPlaidEnv;

    const passed = missing.length === 0 && plaidEnvMatches;
    const detailParts: string[] = [];

    if (missing.length === 0) {
      detailParts.push("required env vars present");
    } else {
      detailParts.push(`missing required env vars (${missing.length}): ${missing.join(", ")}`);
      detailParts.push("set these in your shell/.env, or use --skip-env-check if validated externally");
    }

    if (!plaidEnvMatches) {
      detailParts.push(`PLAID_ENV expected ${expectedPlaidEnv}, got ${plaidEnv ?? "<unset>"}`);
    }

    const result = {
      name: "Env precheck",
      passed,
      details: detailParts.join("; "),
    };
    checks.push(result);
    printCheck(result);
  }

  const sessionResult = await request(
    `${appUrl}/api/session`,
    {
      method: "GET",
      headers: {
        cookie: authCookie,
      },
    },
    timeoutMs,
  );
  const sessionBody = asRecord(sessionResult.body);
  const hasSession = sessionBody ? asRecord(sessionBody.session) !== null : false;
  const sessionCheck = {
    name: "Authenticated session check",
    passed: sessionResult.status === 200 && hasSession,
    details: `GET /api/session returned ${sessionResult.status}`,
  };
  checks.push(sessionCheck);
  printCheck(sessionCheck);

  const plaidStatusResult = await request(
    `${appUrl}/api/plaid/status`,
    {
      method: "GET",
      headers: {
        cookie: authCookie,
      },
    },
    timeoutMs,
  );
  const plaidStatusBody = asRecord(plaidStatusResult.body);
  const plaidEnabled = plaidStatusBody ? asBoolean(plaidStatusBody.plaidEnabled) : null;
  const plaidEnvironment = plaidStatusBody ? asString(plaidStatusBody.plaidEnvironment) : null;
  const reconnectRequiredItems = plaidStatusBody ? asNumber(plaidStatusBody.reconnectRequiredItems) : null;
  const plaidStatusCheck = {
    name: "Plaid status check",
    passed:
      plaidStatusResult.status === 200 &&
      plaidEnabled === true &&
      plaidEnvironment === expectedPlaidEnv,
    details: `GET /api/plaid/status returned ${plaidStatusResult.status}; plaidEnabled=${String(
      plaidEnabled,
    )}; plaidEnvironment=${plaidEnvironment ?? "<unset>"}; reconnectRequiredItems=${
      reconnectRequiredItems ?? "n/a"
    }`,
  };
  checks.push(plaidStatusCheck);
  printCheck(plaidStatusCheck);

  const plaidRefreshResult = await request(
    `${appUrl}/api/plaid/refresh`,
    {
      method: "POST",
      headers: {
        cookie: authCookie,
      },
    },
    timeoutMs,
  );
  const plaidRefreshBody = asRecord(plaidRefreshResult.body);
  const refreshedItems = plaidRefreshBody ? asNumber(plaidRefreshBody.refreshedItems) : null;
  const refreshResults = plaidRefreshBody?.results;
  const refreshErrors = Array.isArray(refreshResults)
    ? refreshResults.filter((item) => {
        const row = asRecord(item as JsonValue);
        return row && asString(row.status) === "error";
      }).length
    : null;

  const plaidRefreshCheck = {
    name: "Plaid refresh check",
    passed: plaidRefreshResult.status === 200 && refreshedItems !== null && (refreshErrors ?? 0) === 0,
    details: `POST /api/plaid/refresh returned ${plaidRefreshResult.status}; refreshedItems=${
      refreshedItems ?? "n/a"
    }; errorItems=${refreshErrors ?? "n/a"}`,
  };
  checks.push(plaidRefreshCheck);
  printCheck(plaidRefreshCheck);

  const preferencesInitialResult = await request(
    `${appUrl}/api/notification-preferences`,
    {
      method: "GET",
      headers: {
        cookie: authCookie,
      },
    },
    timeoutMs,
  );

  const preferencesInitialBody = asRecord(preferencesInitialResult.body);
  const initialPreferences = asRecord(preferencesInitialBody?.preferences ?? null);
  const initialFrequency = asString(initialPreferences?.reminderFrequency ?? null) ?? "weekly";
  const restoreChannel = asString(initialPreferences?.reminderChannel ?? null) ?? "email";

  const setNoneResult = await request(
    `${appUrl}/api/notification-preferences`,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: authCookie,
      },
      body: JSON.stringify({
        reminderChannel: "none",
        reminderFrequency: initialFrequency,
      }),
    },
    timeoutMs,
  );

  const setEmailResult = await request(
    `${appUrl}/api/notification-preferences`,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: authCookie,
      },
      body: JSON.stringify({
        reminderChannel: restoreChannel,
        reminderFrequency: initialFrequency,
      }),
    },
    timeoutMs,
  );

  const preferencesFinalResult = await request(
    `${appUrl}/api/notification-preferences`,
    {
      method: "GET",
      headers: {
        cookie: authCookie,
      },
    },
    timeoutMs,
  );

  const finalBody = asRecord(preferencesFinalResult.body);
  const finalPreferences = asRecord(finalBody?.preferences ?? null);
  const finalChannel = asString(finalPreferences?.reminderChannel ?? null);

  const reminderCheck = {
    name: "Reminder preference toggle check",
    passed:
      preferencesInitialResult.status === 200 &&
      setNoneResult.status === 200 &&
      setEmailResult.status === 200 &&
      preferencesFinalResult.status === 200 &&
      finalChannel === restoreChannel,
    details: `GET/PUT/PUT/GET statuses=${preferencesInitialResult.status}/${setNoneResult.status}/${setEmailResult.status}/${preferencesFinalResult.status}; restoredChannel=${
      finalChannel ?? "<unset>"
    }`,
  };
  checks.push(reminderCheck);
  printCheck(reminderCheck);

  const cronHeaders: Record<string, string> = {
    "content-type": "application/json",
  };

  if (cronSecret.length > 0) {
    cronHeaders.authorization = `Bearer ${cronSecret}`;
  }

  const cronResult = await request(
    `${appUrl}/api/cron/plaid-refresh`,
    {
      method: "POST",
      headers: cronHeaders,
      body: "{}",
    },
    timeoutMs,
  );

  const cronBody = asRecord(cronResult.body);
  const cronErrorCount = cronBody ? asNumber(cronBody.errorCount) : null;
  const cronRefreshedItems = cronBody ? asNumber(cronBody.refreshedItems) : null;
  const cronSkipped = cronBody ? asBoolean(cronBody.skipped) : null;
  const cronCheck = {
    name: "Cron plaid refresh check",
    passed:
      cronResult.status !== 401 &&
      (cronSkipped === true || (cronResult.status === 200 && cronErrorCount !== null && cronErrorCount === 0)),
    details: `POST /api/cron/plaid-refresh returned ${cronResult.status}; refreshedItems=${
      cronRefreshedItems ?? "n/a"
    }; errorCount=${cronErrorCount ?? "n/a"}; skipped=${cronSkipped ?? "n/a"}`,
  };
  checks.push(cronCheck);
  printCheck(cronCheck);

  summarizeAndExit(checks);
}

main().catch((error) => {
  console.error("Launch verification check failed to run");
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
