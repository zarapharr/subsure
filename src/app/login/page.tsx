import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { DEFAULT_AUTHENTICATED_REDIRECT, sanitizeCallbackUrl } from "@/lib/route-guards";
import { env } from "@/env";

function buildLoginUrlWithCallback(callbackUrl: string) {
  const params = new URLSearchParams({ callbackUrl });
  return `/login?${params.toString()}`;
}

async function signInWithCredentials(formData: FormData) {
  "use server";

  const email = formData.get("email");
  const password = formData.get("password");
  const callbackUrl = sanitizeCallbackUrl(formData.get("callbackUrl"));

  if (typeof email !== "string" || typeof password !== "string") return;

  await signIn("credentials", {
    email,
    password,
    redirectTo: callbackUrl,
  });
}

async function signInWithDemo(formData: FormData) {
  "use server";

  const callbackUrl = sanitizeCallbackUrl(formData.get("callbackUrl"));
  const demoEmail = env.AUTH_CREDENTIALS_DEMO_EMAIL;
  const demoPassword = env.AUTH_CREDENTIALS_DEMO_PASSWORD;

  if (!demoEmail || !demoPassword) {
    redirect(buildLoginUrlWithCallback(callbackUrl));
  }

  try {
    await signIn("credentials", {
      email: demoEmail,
      password: demoPassword,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(buildLoginUrlWithCallback(callbackUrl));
    }
    throw error;
  }
}

type LoginPageProps = {
  searchParams?: {
    callbackUrl?: string | string[];
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  const callbackUrl = sanitizeCallbackUrl(searchParams?.callbackUrl);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-slate-600">Use credentials or continue with the seeded demo account.</p>
      </header>

      <form action={signInWithDemo} className="rounded-lg border border-slate-200 p-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <button
          type="submit"
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          Continue with demo account
        </button>
      </form>

      <form
        action={signInWithCredentials}
        className="flex flex-col gap-3 rounded-lg border border-slate-200 p-6"
      >
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700">Email</span>
          <input
            type="email"
            name="email"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="you@example.com"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700">Password</span>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="••••••••"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          Sign in
        </button>
      </form>

      <p className="text-xs text-slate-500">
        Default redirect after sign in: <code>{DEFAULT_AUTHENTICATED_REDIRECT}</code>
      </p>
    </main>
  );
}
