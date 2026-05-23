"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@squarely/ui-web";
import { createBrowserClient } from "@squarely/db/browser";
import { useActiveMerchant } from "@/lib/useActiveMerchant";

type ItemRow = { name: string; priceCents: number };

const db = () =>
  createBrowserClient() as unknown as { from: (t: string) => any };

export default function Onboarding() {
  const router = useRouter();
  const { data: merchantId } = useActiveMerchant();

  const [step, setStep] = useState(1);

  // Step 1 — location fields
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");

  // Step 2 — items
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);

  const [error, setError] = useState<string | null>(null);

  const locationMutation = useMutation({
    mutationFn: async () => {
      if (!merchantId) throw new Error("No active merchant.");
      const { error: err } = await db()
        .from("locations")
        .insert({ merchant_id: merchantId, name, city, region });
      if (err) throw new Error(err.message);
    },
    onSuccess: () => {
      setError(null);
      setStep(2);
    },
    onError: (e: Error) => setError(e.message),
  });

  const itemMutation = useMutation({
    mutationFn: async (row: ItemRow) => {
      if (!merchantId) throw new Error("No active merchant.");
      const { error: err } = await db().from("items").insert({
        merchant_id: merchantId,
        name: row.name,
        price_cents: row.priceCents,
        active: true,
      });
      if (err) throw new Error(err.message);
      return row;
    },
    onSuccess: (row) => {
      setError(null);
      setItems((prev) => [...prev, row]);
      setItemName("");
      setItemPrice("");
    },
    onError: (e: Error) => setError(e.message),
  });

  function submitLocation(e: React.FormEvent) {
    e.preventDefault();
    locationMutation.mutate();
  }

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(parseFloat(itemPrice) * 100);
    if (!itemName.trim() || !Number.isFinite(cents)) {
      setError("Enter a name and a valid price.");
      return;
    }
    itemMutation.mutate({ name: itemName.trim(), priceCents: cents });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mx-auto">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Step {step} / 3</span>
          <Link href="/dashboard" className="text-xs text-slate-500 underline">
            Skip to dashboard
          </Link>
        </div>

        {step === 1 ? (
          <div className="mt-4">
            <h1 className="text-2xl font-bold tracking-tight">Add your first location</h1>
            <p className="mt-2 text-sm text-slate-600">Where do you do business?</p>
            <form className="mt-6 space-y-4" onSubmit={submitLocation}>
              <label className="block text-sm">
                <span className="text-slate-700">Location name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-700">City</span>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-700">Region / State</span>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
                />
              </label>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <Button type="submit" className="w-full" disabled={locationMutation.isPending}>
                {locationMutation.isPending ? "Saving…" : "Continue"}
              </Button>
            </form>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-4">
            <h1 className="text-2xl font-bold tracking-tight">Add a few items</h1>
            <p className="mt-2 text-sm text-slate-600">These will show up in your catalog.</p>

            {items.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {items.map((it, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <span className="text-slate-700">{it.name}</span>
                    <span className="text-slate-500">${(it.priceCents / 100).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <form className="mt-4 space-y-4" onSubmit={addItem}>
              <label className="block text-sm">
                <span className="text-slate-700">Item name</span>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-700">Price (USD)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
                />
              </label>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <Button
                type="submit"
                variant="secondary"
                className="w-full"
                disabled={itemMutation.isPending}
              >
                {itemMutation.isPending ? "Adding…" : "Add another"}
              </Button>
            </form>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep(1);
                }}
                className="text-sm text-slate-600 underline"
              >
                Back
              </button>
              <Button
                type="button"
                className="px-6"
                onClick={() => {
                  setError(null);
                  setStep(3);
                }}
              >
                {items.length > 0 ? "Continue" : "Skip"}
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-4 text-center">
            <h1 className="text-2xl font-bold tracking-tight">You&apos;re all set!</h1>
            <p className="mt-2 text-sm text-slate-600">
              Your store is ready. Head to the dashboard to start selling.
            </p>
            <div className="mt-6">
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  router.push("/dashboard");
                  router.refresh();
                }}
              >
                Go to dashboard
              </Button>
            </div>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="mt-3 text-sm text-slate-600 underline"
            >
              Back
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
