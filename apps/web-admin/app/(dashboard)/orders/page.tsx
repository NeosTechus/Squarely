export default function Orders() {
  return <Placeholder title="Orders" body="Realtime order table arrives in Phase 2." />;
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        {body}
      </p>
    </div>
  );
}
