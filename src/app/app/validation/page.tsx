import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ValidationQueue } from "../validation-queue";

export default async function ValidationPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const displayName = session.user?.name ?? session.user?.email ?? "there";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6 sm:py-10 lg:px-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Validation Surface</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Resolve subscription decisions</h1>
        <p className="text-sm text-slate-600">Work through the queue and confirm keep/cancel actions one by one.</p>
        <Link href="/app" className="text-sm font-medium text-slate-900 underline underline-offset-2">
          Back to dashboard
        </Link>
      </header>

      <ValidationQueue displayName={displayName} />
    </main>
  );
}
