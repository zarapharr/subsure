export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-slate-600">
          Signup flow lands in SUB auth ticket. This page is a stub.
        </p>
      </header>
      <form
        action="/api/auth/signin"
        method="post"
        className="flex flex-col gap-3 rounded-lg border border-slate-200 p-6"
      >
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
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          Send magic link
        </button>
      </form>
    </main>
  );
}
