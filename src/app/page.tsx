import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-widest text-slate-500">SubSure</p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Validate every recurring charge you pay for.
        </h1>
        <p className="text-lg text-slate-600">
          Discover, verify, and intentionally approve every subscription on your accounts.
        </p>
      </header>
      <div className="flex gap-3">
        <Link
          href="/signup"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          Sign in
        </Link>
      </div>
      <p className="text-xs text-slate-500">
        Scaffold placeholder. Validation queue, dashboard, and Plaid linking arrive in follow-up
        tickets.
      </p>
    </main>
  );
}
