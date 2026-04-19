import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { DEFAULT_AUTHENTICATED_REDIRECT } from "@/lib/route-guards";
import { env } from "@/env";

function buildLoginFallbackUrl() {
  const params = new URLSearchParams({ callbackUrl: DEFAULT_AUTHENTICATED_REDIRECT });
  return `/login?${params.toString()}`;
}

async function startDemoSession() {
  "use server";

  const demoEmail = env.AUTH_CREDENTIALS_DEMO_EMAIL;
  const demoPassword = env.AUTH_CREDENTIALS_DEMO_PASSWORD;

  if (!demoEmail || !demoPassword) {
    redirect(buildLoginFallbackUrl());
  }

  try {
    await signIn("credentials", {
      email: demoEmail,
      password: demoPassword,
      redirectTo: DEFAULT_AUTHENTICATED_REDIRECT,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(buildLoginFallbackUrl());
    }
    throw error;
  }
}

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Get into the SubSure demo</h1>
        <p className="text-sm text-slate-600">
          Signup review is still in flight. Use the seeded demo account to continue immediately.
        </p>
      </header>

      <div className="space-y-4 rounded-lg border border-slate-200 p-6">
        <form action={startDemoSession}>
          <button
            type="submit"
            className="inline-flex w-full justify-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            Continue with demo account
          </button>
        </form>

        <p className="text-xs text-slate-500">Need manual credentials instead?</p>
        <Link
          href="/login"
          className="inline-flex w-full justify-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          Open sign in form
        </Link>
      </div>
    </main>
  );
}
