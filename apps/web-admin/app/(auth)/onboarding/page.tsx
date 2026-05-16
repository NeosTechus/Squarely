export default function Onboarding() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-3xl font-bold tracking-tight">Set up your store</h1>
      <ol className="mt-8 space-y-3 text-sm text-slate-600">
        <li>1. Store details (name, address, timezone, currency)</li>
        <li>2. Pick a plan (Stripe Checkout)</li>
        <li>3. Import menu CSV or start from template</li>
        <li>4. Register first printer + card reader</li>
        <li>5. Launch dashboard</li>
      </ol>
    </main>
  );
}
