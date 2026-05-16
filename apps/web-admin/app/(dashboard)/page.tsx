export default function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Today's revenue" value="$0.00" />
        <Stat label="Orders" value="0" />
        <Stat label="Avg ticket" value="$0.00" />
        <Stat label="Open tickets" value="0" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Welcome to Squarely</h2>
        <p className="mt-2 text-sm text-slate-600">
          Connect a device, create your first item, and ring up a sale. Phase 2 of the build will
          wire real data here via Supabase realtime subscriptions.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
