import { SignOutButton } from "@/components/SignOutButton";

export default function Suspended() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="text-3xl">⏸️</div>
        <h1 className="mt-3 text-xl font-bold tracking-tight">Account suspended</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your store has been suspended. Please contact Squarely support to restore access.
        </p>
        <div className="mt-6 flex justify-center">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
