import { Button } from "@squarely/ui-web";

export default function Login() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Log in to Squarely</h1>
        <p className="mt-2 text-sm text-slate-600">Use your merchant account.</p>
        <form className="mt-6 space-y-4" action="/login" method="post">
          <label className="block text-sm">
            <span className="text-slate-700">Email</span>
            <input
              type="email"
              name="email"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
            />
          </label>
          <Button type="submit" className="w-full">Send magic link</Button>
        </form>
      </div>
    </main>
  );
}
