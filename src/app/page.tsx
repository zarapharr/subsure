import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { DEFAULT_AUTHENTICATED_REDIRECT, sanitizeCallbackUrl } from "@/lib/route-guards";
import { env } from "@/env";

function buildLoginFallbackUrl(callbackUrl: string) {
  const params = new URLSearchParams({ callbackUrl });
  return `/login?${params.toString()}`;
}

async function continueToDemo(formData: FormData) {
  "use server";

  const callbackUrl = sanitizeCallbackUrl(formData.get("callbackUrl"));
  const demoEmail = env.AUTH_CREDENTIALS_DEMO_EMAIL;
  const demoPassword = env.AUTH_CREDENTIALS_DEMO_PASSWORD;

  if (!demoEmail || !demoPassword) {
    redirect(buildLoginFallbackUrl(callbackUrl));
  }

  try {
    await signIn("credentials", {
      email: demoEmail,
      password: demoPassword,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(buildLoginFallbackUrl(callbackUrl));
    }
    throw error;
  }
}

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-widest text-slate-500">SubSure</p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Validate every recurring charge you pay for.
        </h1>
        <p className="text-lg text-slate-600">
          Enter any work email to launch the live demo workspace instantly.
        </p>
      </header>

      <form
        action={continueToDemo}
        className="flex flex-col gap-3 rounded-lg border border-slate-200 p-5 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="callbackUrl" value={DEFAULT_AUTHENTICATED_REDIRECT} />
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-slate-700">Work email</span>
          <input
            type="email"
            name="email"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="name@company.com"
            autoComplete="email"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Continue to demo
        </button>
      </form>

      <div className="flex gap-3">
        <Link
          href="/signup"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          Sign up
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          Sign in
        </Link>
      </div>

      <p className="text-xs text-slate-500">
        Demo access uses the seeded review account while signup enrollment is being finalized.
      </p>
    </main>
  );
}
