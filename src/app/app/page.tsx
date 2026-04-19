import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { DemoMvpWorkspace } from "./demo-mvp-workspace";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function AppPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const displayName = session.user?.name ?? session.user?.email ?? "there";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6 sm:py-10 lg:px-8">
      <header className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-widest text-slate-500">SubSure App</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Welcome back, {displayName}.</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Validate each detected subscription with explicit keep/cancel decisions.
          </p>
        </div>
        <form action={signOutAction}>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link
              href="/app/notifications"
              className="inline-flex w-full justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 sm:w-auto"
            >
              Notifications
            </Link>
            <button
              type="submit"
              className="inline-flex w-full justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 sm:w-auto"
            >
              Sign out
            </button>
          </div>
        </form>
      </header>

      <DemoMvpWorkspace displayName={displayName} />
    </main>
  );
}
